import { describe, expect, it } from "vitest";

import {
  denyByDefault,
  evaluateGatewayPolicy,
  evaluatePolicy,
  evaluatePolicyDecision,
  type PolicyGrant,
  type PolicyDecisionInput,
  type PolicyInput,
  type PolicyTool
} from "./index";

const now = new Date("2026-01-01T00:00:00.000Z");

describe("policy evaluator deny precedence", () => {
  it.each([
    [
      "emergency deny takes precedence over disabled server",
      baseInput({ emergencyDeny: { enabled: true, reason: "maintenance" }, serverEnabled: false }),
      "EMERGENCY_DENY",
      "maintenance"
    ],
    ["disabled server denies", baseInput({ serverEnabled: false }), "SERVER_DISABLED", "Server echo is disabled."],
    ["disabled tool denies", baseInput({ tool: tool("echo_message", "low", false), grants: [] }), "TOOL_DISABLED", "Tool is disabled"],
    ["missing connect grant denies", baseInput({ grants: [] }), "CONNECT_GRANT_REQUIRED", "No active grant"],
    [
      "disabled grant does not match",
      baseInput({ grants: [grant({ id: "disabled-grant", enabled: false })] }),
      "CONNECT_GRANT_REQUIRED",
      "No active grant"
    ],
    [
      "expired grant does not match",
      baseInput({ grants: [grant({ id: "expired-grant", expiresAt: "2025-12-31T00:00:00.000Z" })] }),
      "CONNECT_GRANT_REQUIRED",
      "No active grant"
    ],
    [
      "prod server requires prod grant",
      baseInput({ environment: "prod", grants: [grant({ id: "dev-grant", environment: "dev" })] }),
      "PROD_GRANT_REQUIRED",
      "Production servers require"
    ],
    [
      "admin action requires platform admin",
      baseInput({ action: "admin", isPlatformAdmin: false }),
      "ADMIN_REQUIRES_PLATFORM_ADMIN",
      "Admin actions require"
    ]
  ])("%s", (_name, input, reasonCode, reasonText) => {
    const result = evaluatePolicy(input);

    expect(result.effect).toBe("deny");
    expect(result.reasonCode).toBe(reasonCode);
    expect(result.reason).toContain(reasonText);
    expect(result.matchedGrantIds).toEqual([]);
    expect(result.requiresApproval).toBe(false);
    expect(result.requiresStepUp).toBe(false);
  });

  it.each([
    ["global deny", { global: true }, {}, true],
    ["high/critical deny matches high-risk tools", { highCritical: true }, { tool: tool("restart_cluster", "high") }, true],
    ["high/critical deny ignores low-risk tools", { highCritical: true }, { tool: tool("echo_message", "low") }, false],
    ["server deny", { serverIds: ["server-1"] }, {}, true],
    ["tool deny", { toolNames: ["echo_message"] }, {}, true],
    ["subject deny", { subjectIds: ["admin-user"] }, {}, true],
    ["client deny", { clientIds: ["mcp-client"] }, { clientId: "mcp-client" }, true]
  ])("applies emergency %s scope", (_name, emergencyDeny, options, denied) => {
    const result = evaluatePolicy(
      baseInput({
        ...options,
        emergencyDeny: { enabled: true, reason: "scoped emergency", ...emergencyDeny }
      })
    );

    if (denied) {
      expect(result).toMatchObject({ effect: "deny", allowed: false, reasonCode: "EMERGENCY_DENY", reason: "scoped emergency" });
      return;
    }

    expect(result).toMatchObject({ effect: "allow", allowed: true, reasonCode: "ALLOW" });
  });
});

describe("policy evaluator grants and approvals", () => {
  it("adapts the prompt-shaped PolicyDecisionInput without leaking internal effect fields", () => {
    const input: PolicyDecisionInput = {
      subject: {
        type: "team",
        teamIds: ["platform-team"]
      },
      client: {
        clientId: "mcp-client",
        clientType: "opencode"
      },
      project: {
        projectId: "project-1"
      },
      server: {
        serverId: "server-1",
        serverSlug: "echo",
        environment: "dev",
        enabled: true
      },
      tool: tool("echo_message"),
      action: "call_tool",
      requestTime: now.toISOString()
    };

    const result = evaluatePolicyDecision(input, {
      grants: [grant({ subjectType: "team", subjectId: "platform-team", projectId: "project-1" })]
    });

    expect(result).toEqual({
      allowed: true,
      reasonCode: "ALLOW",
      reason: "Tool is granted for this principal.",
      matchedGrantIds: ["grant-1"]
    });
    expect("effect" in result).toBe(false);
  });

  it("allows connect when an active subject grant matches", () => {
    const result = evaluatePolicy(baseInput({ action: "connect" }));

    expect(result).toMatchObject({
      effect: "allow",
      allowed: true,
      reasonCode: "ALLOW",
      matchedGrantIds: ["grant-1"],
      requiresApproval: false,
      requiresStepUp: false
    });
  });

  it("filters tools/list discovery to enabled granted tools", () => {
    const result = evaluatePolicy(
      baseInput({
        action: "tools/list",
        grants: [grant({ allowedTools: ["echo_message", "hidden_tool"] })],
        tools: [tool("echo_message"), tool("hidden_tool", "low", false), tool("ungranted_tool")]
      })
    );

    expect(result).toMatchObject({
      effect: "allow",
      allowed: true,
      reasonCode: "ALLOW",
      matchedGrantIds: ["grant-1"],
      discoverableToolNames: ["echo_message"]
    });
  });

  it("supports prompt action names for discovery, tool calls, resources, and prompts", () => {
    expect(
      evaluatePolicy(
        baseInput({
          action: "discover_tool",
          grants: [grant({ allowedTools: ["echo_message", "hidden_tool"] })],
          tools: [tool("echo_message"), tool("hidden_tool", "low", false), tool("ungranted_tool")]
        })
      )
    ).toMatchObject({
      effect: "allow",
      allowed: true,
      reasonCode: "ALLOW",
      matchedGrantIds: ["grant-1"],
      discoverableToolNames: ["echo_message"]
    });

    expect(evaluatePolicy(baseInput({ action: "call_tool" }))).toMatchObject({
      effect: "allow",
      allowed: true,
      reasonCode: "ALLOW",
      matchedGrantIds: ["grant-1"]
    });

    expect(evaluatePolicy(baseInput({ action: "read_resource" }))).toMatchObject({
      effect: "allow",
      allowed: true,
      reasonCode: "ALLOW",
      matchedGrantIds: ["grant-1"]
    });

    expect(evaluatePolicy(baseInput({ action: "get_prompt" }))).toMatchObject({
      effect: "allow",
      allowed: true,
      reasonCode: "ALLOW",
      matchedGrantIds: ["grant-1"]
    });
  });

  it("denies tools/call when no active grant allows the tool", () => {
    const result = evaluatePolicy(baseInput({ grants: [grant({ allowedTools: ["other_tool"] })] }));

    expect(result).toMatchObject({ effect: "deny", allowed: false, reasonCode: "TOOL_GRANT_REQUIRED", matchedGrantIds: [] });
  });

  it("matches project-scoped grants only when request project context matches", () => {
    const scopedGrant = grant({ projectId: "project-1" });

    expect(evaluatePolicy(baseInput({ projectId: "project-1", grants: [scopedGrant] }))).toMatchObject({
      effect: "allow",
      matchedGrantIds: ["grant-1"]
    });
    expect(evaluatePolicy(baseInput({ grants: [scopedGrant] }))).toMatchObject({
      effect: "deny",
      reasonCode: "CONNECT_GRANT_REQUIRED",
      matchedGrantIds: []
    });
    expect(evaluatePolicy(baseInput({ projectId: "project-2", grants: [scopedGrant] }))).toMatchObject({
      effect: "deny",
      reasonCode: "CONNECT_GRANT_REQUIRED",
      matchedGrantIds: []
    });
  });

  it.each([
    [
      "wildcard high-risk grant is not explicit",
      baseInput({ grants: [grant({ allowedTools: ["*"] })], tool: tool("restart_cluster", "high") }),
      "deny",
      "EXPLICIT_TOOL_GRANT_REQUIRED",
      false,
      false
    ],
    [
      "unapproved high-risk explicit grant needs approval",
      baseInput({ grants: [grant({ allowedTools: ["restart_cluster"] })], tool: tool("restart_cluster", "high") }),
      "needs_approval",
      "APPROVAL_REQUIRED",
      true,
      false
    ],
    [
      "approved high-risk explicit grant allows",
      baseInput({ grants: [grant({ allowedTools: ["restart_cluster"], approvedBy: "admin-user" })], tool: tool("restart_cluster", "high") }),
      "allow",
      "ALLOW",
      false,
      false
    ],
    [
      "approved critical grant requires step-up",
      baseInput({ grants: [grant({ allowedTools: ["drop_index"], approvedBy: "admin-user" })], tool: tool("drop_index", "critical") }),
      "needs_approval",
      "STEP_UP_REQUIRED",
      false,
      true
    ],
    [
      "approved critical grant with step-up allows",
      baseInput({
        grants: [grant({ allowedTools: ["drop_index"], approvedBy: "admin-user" })],
        tool: tool("drop_index", "critical"),
        stepUpSatisfied: true
      }),
      "allow",
      "ALLOW",
      false,
      false
    ]
  ])("%s", (_name, input, effect, reasonCode, requiresApproval, requiresStepUp) => {
    const result = evaluatePolicy(input);

    expect(result).toMatchObject({ effect, allowed: effect === "allow", reasonCode, requiresApproval, requiresStepUp });
  });

  it("matches service-account grants only to the exact service-account subject", () => {
    const serviceAccountResult = evaluatePolicy(
      baseInput({
        principalType: "service_account",
        subject: "svc:catalog-sync",
        grants: [grant({ subjectType: "service_account", subjectId: "svc:catalog-sync" })]
      })
    );
    const userResult = evaluatePolicy(
      baseInput({
        subject: "svc:catalog-sync",
        grants: [grant({ subjectType: "service_account", subjectId: "svc:catalog-sync" })]
      })
    );

    expect(serviceAccountResult.effect).toBe("allow");
    expect(userResult).toMatchObject({ effect: "deny", reasonCode: "CONNECT_GRANT_REQUIRED" });
  });
});

describe("compatibility exports", () => {
  it("keeps denyByDefault fields stable", () => {
    expect(denyByDefault).toMatchObject({
      effect: "deny",
      allowed: false,
      reasonCode: "DENY_BY_DEFAULT",
      matchedGrantIds: [],
      requiresApproval: false,
      requiresStepUp: false
    });
  });

  it("preserves evaluateGatewayPolicy allowedTools behavior", () => {
    expect(
      evaluateGatewayPolicy({
        userId: "admin-user",
        teamIds: ["platform-team"],
        clientId: "mcp-client",
        serverId: "server-1",
        serverSlug: "echo",
        toolName: "echo_message",
        environment: "dev",
        riskLevel: "low",
        requestTime: now.toISOString(),
        allowedTools: ["echo_message"]
      })
    ).toMatchObject({ effect: "allow", allowed: true, reasonCode: "ALLOW" });

    expect(
      evaluateGatewayPolicy({
        userId: "admin-user",
        teamIds: ["platform-team"],
        clientId: "mcp-client",
        serverId: "server-1",
        serverSlug: "echo",
        toolName: "dangerous_tool",
        environment: "dev",
        riskLevel: "critical",
        requestTime: now.toISOString(),
        allowedTools: ["dangerous_tool"]
      })
    ).toMatchObject({ effect: "needs_approval", allowed: false, reasonCode: "APPROVAL_REQUIRED", requiresApproval: true });
  });

  it("denies malformed Gateway policy metadata instead of downgrading it", () => {
    const input = {
      userId: "admin-user",
      teamIds: ["platform-team"],
      clientId: "mcp-client",
      serverId: "server-1",
      serverSlug: "echo",
      toolName: "dangerous_tool",
      environment: "prod",
      riskLevel: "critical",
      requestTime: now.toISOString(),
      allowedTools: ["dangerous_tool"]
    };

    expect(evaluateGatewayPolicy({ ...input, environment: "production" })).toMatchObject({
      effect: "deny",
      reasonCode: "INVALID_ENVIRONMENT"
    });
    expect(evaluateGatewayPolicy({ ...input, riskLevel: "critical " })).toMatchObject({
      effect: "deny",
      reasonCode: "INVALID_RISK_LEVEL"
    });
  });
});

function baseInput(options: {
  action?: PolicyInput["action"];
  subject?: string;
  principalType?: PolicyInput["principal"]["principalType"];
  isPlatformAdmin?: boolean;
  clientId?: string;
  projectId?: string;
  serverEnabled?: boolean;
  environment?: PolicyInput["server"]["environment"];
  tool?: PolicyTool;
  tools?: PolicyTool[];
  grants?: PolicyGrant[];
  emergencyDeny?: PolicyInput["emergencyDeny"];
  stepUpSatisfied?: boolean;
} = {}): PolicyInput {
  const selectedTool = options.tool ?? tool("echo_message");

  return {
    principal: {
      subject: options.subject ?? "admin-user",
      principalType: options.principalType ?? "user",
      teamIds: ["platform-team"],
      teams: ["platform-team"],
      isPlatformAdmin: options.isPlatformAdmin ?? true
    },
    action: options.action ?? "tools/call",
    clientId: options.clientId,
    projectId: options.projectId,
    requestTime: now,
    server: {
      id: "server-1",
      slug: "echo",
      environment: options.environment ?? "dev",
      enabled: options.serverEnabled ?? true,
      tools: options.tools ?? [selectedTool]
    },
    tool: selectedTool,
    toolName: selectedTool.name,
    grants: options.grants ?? [grant({ allowedTools: [selectedTool.name], environment: options.environment ?? "dev" })],
    emergencyDeny: options.emergencyDeny,
    stepUpSatisfied: options.stepUpSatisfied
  };
}

function tool(name: string, riskLevel: PolicyTool["riskLevel"] = "low", enabled = true): PolicyTool {
  return { name, riskLevel, enabled };
}

function grant(options: Partial<PolicyGrant> = {}): PolicyGrant {
  return {
    id: "grant-1",
    subjectType: "user",
    subjectId: "admin-user",
    serverId: "server-1",
    allowedTools: ["echo_message"],
    environment: "dev",
    enabled: true,
    ...options
  };
}
