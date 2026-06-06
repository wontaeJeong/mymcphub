import { afterEach, describe, expect, it, vi } from "vitest";

import { hashAuditArguments } from "./audit";
import { createApiServer } from "./index";

const { withSpanMock } = vi.hoisted(() => ({
  withSpanMock: vi.fn(async <T>(_service: string, _spanName: string, _attributes: Record<string, string | number | boolean> | undefined, fn: () => T | Promise<T>) => fn())
}));

vi.mock("@mcp-hub/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }),
  withSpan: withSpanMock
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("createApiServer", () => {
  it("serves the API health check", async () => {
    const app = createApiServer();
    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ service: "api", status: "ok" });
    expect(withSpanMock).toHaveBeenCalledWith("api", "mcp.api.request", expect.any(Object), expect.any(Function));

    await app.close();
  });

  it("serves readiness and mock auth context", async () => {
    const app = createApiServer();

    const ready = await app.inject({ method: "GET", url: "/readyz" });
    const me = await app.inject({ method: "GET", url: "/api/me" });

    expect(ready.statusCode).toBe(200);
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      auth: {
        userId: "00000000-0000-4000-8000-000000000001",
        principalType: "user",
        email: "admin@example.com",
        displayName: "Admin User",
        teamIds: ["00000000-0000-4000-8000-000000000010"],
        roles: ["admin"],
        clientId: "local-dev-client",
        issuer: "mock-auth",
        audience: "mcp-hub",
        groups: ["platform"],
        isAdmin: true,
        isPlatformAdmin: true,
        authSource: "mock",
        tokenIssuer: "mock-auth"
      }
    });

    await app.close();
  });

  it("lists seed servers and creates grants", async () => {
    const app = createApiServer();

    const servers = await app.inject({ method: "GET", url: "/api/servers" });
    const serverItems = servers.json<{ items: Array<{ id: string; slug: string }> }>().items;
    const echoServer = serverItems.find((server) => server.slug === "echo");
    const stdioSampleServer = serverItems.find((server) => server.slug === "stdio-sample");

    expect(echoServer).toBeDefined();
    expect(stdioSampleServer).toBeDefined();

    const grant = await app.inject({
      method: "POST",
      url: "/api/grants",
      payload: {
        subjectType: "team",
        subjectId: "00000000-0000-4000-8000-000000000010",
        projectId: "00000000-0000-4000-8000-000000000020",
        serverId: echoServer?.id,
        allowedTools: ["echo_message"],
        environment: "dev",
        reason: "Integration test grant"
      }
    });

    expect(grant.statusCode).toBe(201);
    expect(grant.json()).toMatchObject({ enabled: true, reason: "Integration test grant" });

    await app.close();
  });

  it("propagates x-trace-id into audit records and response headers", async () => {
    const app = createApiServer();
    const traceId = "trace-from-test";

    const grant = await app.inject({
      method: "POST",
      url: "/api/grants",
      headers: { "x-trace-id": traceId },
      payload: {
        subjectType: "team",
        subjectId: "00000000-0000-4000-8000-000000000010",
        projectId: "00000000-0000-4000-8000-000000000020",
        serverId: "00000000-0000-4000-8000-000000000100",
        allowedTools: ["echo_message"],
        environment: "dev",
        reason: "Trace propagation test",
        token: "raw-token"
      }
    });
    const audit = await app.inject({ method: "GET", url: `/api/audit-events?trace_id=${traceId}` });
    const auditItems = audit.json<{
      items: Array<{ traceId: string; eventType: string; argumentHash?: string; argumentRedactedJson?: { token?: string } }>;
    }>().items;

    expect(grant.statusCode).toBe(201);
    expect(grant.headers["x-trace-id"]).toBe(traceId);
    expect(auditItems).toHaveLength(1);
    expect(auditItems[0]).toMatchObject({ traceId, eventType: "grant.created", argumentHash: expect.any(String) });
    expect(auditItems[0]?.argumentRedactedJson?.token).toBe("[REDACTED]");
    expect(JSON.stringify(auditItems[0])).not.toContain("raw-token");

    await app.close();
  });

  it("approves approvals and paginates audit events", async () => {
    const app = createApiServer();
    const serverId = "00000000-0000-4000-8000-000000000100";

    const approval = await app.inject({
      method: "POST",
      url: "/api/approvals",
      payload: {
        subjectType: "team",
        subjectId: "00000000-0000-4000-8000-000000000010",
        projectId: "00000000-0000-4000-8000-000000000020",
        serverId,
        requestedTools: ["echo_message"],
        environment: "dev",
        requestedAction: "grant_tool",
        reason: "Need echo access"
      }
    });
    const created = approval.json<{ id: string }>();

    const approved = await app.inject({
      method: "POST",
      url: `/api/approvals/${created.id}/approve`
    });
    const audit = await app.inject({ method: "GET", url: "/api/audit-events?limit=1" });
    const grants = await app.inject({ method: "GET", url: "/api/grants" });

    expect(approval.statusCode).toBe(201);
    expect(approved.json()).toMatchObject({
      status: "approved",
      reviewerId: "00000000-0000-4000-8000-000000000001",
      requestedTools: ["echo_message"],
      updatedAt: expect.any(String)
    });
    expect(grants.json<{ items: Array<{ subjectType: string; subjectId: string; allowedTools: string[] }> }>().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subjectType: "team",
          subjectId: "00000000-0000-4000-8000-000000000010",
          allowedTools: ["echo_message"]
        })
      ])
    );
    expect(audit.json()).toMatchObject({ pageInfo: { limit: 1 } });

    await app.close();
  });

  it("filters audit events and preserves cursor pagination by event id", async () => {
    const app = createApiServer();
    const serverId = "00000000-0000-4000-8000-000000000100";
    const projectId = "00000000-0000-4000-8000-000000000020";

    await app.inject({
      method: "POST",
      url: "/api/approvals",
      headers: { "x-trace-id": "audit-filter-approval" },
      payload: {
        subjectType: "team",
        subjectId: "00000000-0000-4000-8000-000000000010",
        projectId,
        serverId,
        requestedTools: ["echo_message"],
        environment: "dev",
        reason: "Filter approval"
      }
    });
    await app.inject({
      method: "POST",
      url: "/api/grants",
      headers: { "x-trace-id": "audit-filter-grant" },
      payload: {
        subjectType: "team",
        subjectId: "00000000-0000-4000-8000-000000000010",
        projectId,
        serverId,
        allowedTools: ["echo_message"],
        environment: "dev",
        reason: "Filter grant"
      }
    });

    const filtered = await app.inject({
      method: "GET",
      url: `/api/audit-events?server=${serverId}&tool=echo_message&event_type=approval.created&policy_decision=needs_approval&risk_level=low&project=${projectId}&team=00000000-0000-4000-8000-000000000010&user=00000000-0000-4000-8000-000000000001&trace_id=audit-filter-approval`
    });
    const pageOne = await app.inject({ method: "GET", url: "/api/audit-events?limit=1" });
    const pageOneJson = pageOne.json<{ items: Array<{ id: string }>; pageInfo: { nextCursor?: string } }>();
    const pageTwo = await app.inject({ method: "GET", url: `/api/audit-events?limit=1&cursor=${pageOneJson.pageInfo.nextCursor}` });
    const pageTwoJson = pageTwo.json<{ items: Array<{ id: string }> }>();

    expect(filtered.json()).toMatchObject({
      items: [
        expect.objectContaining({
          eventType: "approval.created",
          policyDecision: "needs_approval",
          traceId: "audit-filter-approval",
          projectId,
          serverId,
          toolName: "echo_message"
        })
      ]
    });
    expect(pageOneJson.items).toHaveLength(1);
    expect(pageTwoJson.items).toHaveLength(1);
    expect(pageOneJson.pageInfo.nextCursor).toBe(pageOneJson.items[0]?.id);
    expect(pageTwoJson.items[0]?.id).not.toBe(pageOneJson.items[0]?.id);

    await app.close();
  });

  it("derives audit risk from target tool and supports risk filters", async () => {
    const app = createApiServer();
    const server = await app.inject({
      method: "POST",
      url: "/api/servers",
      payload: {
        slug: "risk-api-test",
        displayName: "Risk API Test",
        ownerTeamId: "00000000-0000-4000-8000-000000000010",
        environment: "dev",
        transport: "streamable_http",
        upstreamUrl: "http://localhost:5999/mcp",
        riskLevel: "medium",
        tools: [{ name: "critical_tool", inputSchema: { type: "object" }, riskLevel: "critical" }]
      }
    });
    const serverId = server.json<{ id: string }>().id;

    await app.inject({
      method: "POST",
      url: "/api/approvals",
      headers: { "x-trace-id": "risk-filter-trace" },
      payload: {
        projectId: "00000000-0000-4000-8000-000000000020",
        serverId,
        requestedTools: ["critical_tool"],
        reason: "Need critical access"
      }
    });
    const filtered = await app.inject({ method: "GET", url: `/api/audit-events?trace_id=risk-filter-trace&risk_level=critical` });

    expect(filtered.json()).toMatchObject({
      items: [expect.objectContaining({ eventType: "approval.created", riskLevel: "critical", toolName: "critical_tool" })]
    });

    await app.close();
  });

  it("rejects invalid audit limits", async () => {
    const app = createApiServer();

    const response = await app.inject({ method: "GET", url: "/api/audit-events?limit=0" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });

    await app.close();
  });

  it("serves Prometheus metrics text", async () => {
    const app = createApiServer();

    await app.inject({ method: "GET", url: "/api/servers" });
    const metrics = await app.inject({ method: "GET", url: "/metrics" });

    expect(metrics.statusCode).toBe(200);
    expect(metrics.headers["content-type"]).toContain("text/plain");
    expect(metrics.body).toContain("# HELP mcp_api_requests_total");
    expect(metrics.body).toContain('mcp_api_requests_total{method="GET",route="/api/servers",status_family="2xx"}');

    await app.close();
  });

  it("rejects duplicate approval decisions and persists rejection comments", async () => {
    const app = createApiServer();
    const serverId = "00000000-0000-4000-8000-000000000100";

    const approval = await app.inject({
      method: "POST",
      url: "/api/approvals",
      payload: {
        projectId: "00000000-0000-4000-8000-000000000020",
        serverId,
        toolName: "approval_only_tool",
        reason: "Need echo access"
      }
    });
    const created = approval.json<{ id: string }>();

    const rejected = await app.inject({
      method: "POST",
      url: `/api/approvals/${created.id}/reject`,
      payload: { reviewComment: "Use existing grant" }
    });
    const duplicate = await app.inject({
      method: "POST",
      url: `/api/approvals/${created.id}/approve`
    });
    const grants = await app.inject({ method: "GET", url: "/api/grants" });

    expect(rejected.json()).toMatchObject({
      status: "rejected",
      reviewComment: "Use existing grant",
      reviewerId: "00000000-0000-4000-8000-000000000001"
    });
    expect(duplicate.statusCode).toBe(400);
    expect(duplicate.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(grants.json<{ items: Array<{ allowedTools: string[] }> }>().items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ allowedTools: ["approval_only_tool"] })])
    );

    await app.close();
  });

  it("requires explicit approval tools and valid approval ticket URLs", async () => {
    const app = createApiServer();
    const serverId = "00000000-0000-4000-8000-000000000100";

    const missingTools = await app.inject({
      method: "POST",
      url: "/api/approvals",
      payload: {
        projectId: "00000000-0000-4000-8000-000000000020",
        serverId,
        reason: "Need broad access"
      }
    });
    const wildcardTools = await app.inject({
      method: "POST",
      url: "/api/approvals",
      payload: {
        projectId: "00000000-0000-4000-8000-000000000020",
        serverId,
        requestedTools: ["*"],
        reason: "Need broad access"
      }
    });
    const invalidTicketUrl = await app.inject({
      method: "POST",
      url: "/api/approvals",
      payload: {
        projectId: "00000000-0000-4000-8000-000000000020",
        serverId,
        requestedTools: ["echo_message"],
        ticketUrl: "not a url",
        reason: "Need echo access"
      }
    });
    const unsafeTicketUrl = await app.inject({
      method: "POST",
      url: "/api/approvals",
      payload: {
        projectId: "00000000-0000-4000-8000-000000000020",
        serverId,
        requestedTools: ["echo_message"],
        ticketUrl: "javascript:alert(1)",
        reason: "Need echo access"
      }
    });

    expect(missingTools.statusCode).toBe(400);
    expect(wildcardTools.statusCode).toBe(400);
    expect(invalidTicketUrl.statusCode).toBe(400);
    expect(unsafeTicketUrl.statusCode).toBe(400);

    await app.close();
  });

  it("keeps approval requests open to users but restricts grant and decision routes to platform admins", async () => {
    const previousAuthMode = process.env.MCP_AUTH_MODE;
    process.env.MCP_AUTH_MODE = "oidc";
    const app = createApiServer();
    const readerHeaders = {
      "x-user-id": "reader-user",
      "x-user-email": "reader@example.com",
      "x-team-ids": "00000000-0000-4000-8000-000000000010",
      "x-groups": "readers",
      "x-roles": "reader"
    };

    try {
      const grant = await app.inject({
        method: "POST",
        url: "/api/grants",
        headers: readerHeaders,
        payload: {
          subjectType: "team",
          subjectId: "00000000-0000-4000-8000-000000000010",
          projectId: "00000000-0000-4000-8000-000000000020",
          serverId: "00000000-0000-4000-8000-000000000100",
          allowedTools: ["echo_message"],
          environment: "dev",
          reason: "Reader should not grant direct access"
        }
      });
      const approval = await app.inject({
        method: "POST",
        url: "/api/approvals",
        headers: readerHeaders,
        payload: {
          subjectType: "team",
          subjectId: "00000000-0000-4000-8000-000000000010",
          projectId: "00000000-0000-4000-8000-000000000020",
          serverId: "00000000-0000-4000-8000-000000000100",
          requestedTools: ["echo_message"],
          environment: "dev",
          reason: "Reader can request approval"
        }
      });
      const createdApproval = approval.json<{ id: string }>();
      const approve = await app.inject({
        method: "POST",
        url: `/api/approvals/${createdApproval.id}/approve`,
        headers: readerHeaders
      });

      expect(grant.statusCode).toBe(403);
      expect(grant.json()).toMatchObject({ error: { code: "AUTHORIZATION_DENIED" } });
      expect(approval.statusCode).toBe(201);
      expect(approve.statusCode).toBe(403);
    } finally {
      await app.close();
      if (previousAuthMode === undefined) {
        delete process.env.MCP_AUTH_MODE;
      } else {
        process.env.MCP_AUTH_MODE = previousAuthMode;
      }
    }
  });

  it("defaults approval and approval-created grant environment from the selected server", async () => {
    const app = createApiServer();
    const server = await app.inject({
      method: "POST",
      url: "/api/servers",
      payload: {
        slug: "stg-echo",
        displayName: "Staging Echo",
        ownerTeamId: "00000000-0000-4000-8000-000000000010",
        environment: "stg",
        transport: "streamable_http",
        upstreamUrl: "http://localhost:5104/mcp",
        tools: [
          {
            name: "stg_echo",
            inputSchema: { type: "object" }
          }
        ]
      }
    });
    const createdServer = server.json<{ id: string }>();
    const approval = await app.inject({
      method: "POST",
      url: "/api/approvals",
      payload: {
        subjectType: "team",
        subjectId: "00000000-0000-4000-8000-000000000010",
        projectId: "00000000-0000-4000-8000-000000000020",
        serverId: createdServer.id,
        requestedTools: ["stg_echo"],
        reason: "Need staging echo access"
      }
    });
    const createdApproval = approval.json<{ id: string; environment: string }>();
    const approved = await app.inject({ method: "POST", url: `/api/approvals/${createdApproval.id}/approve` });
    const grants = await app.inject({ method: "GET", url: "/api/grants" });

    expect(approval.statusCode).toBe(201);
    expect(createdApproval.environment).toBe("stg");
    expect(approved.json()).toMatchObject({ status: "approved", environment: "stg" });
    expect(grants.json<{ items: Array<{ serverId: string; allowedTools: string[]; environment: string }> }>().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serverId: createdServer.id,
          allowedTools: ["stg_echo"],
          environment: "stg"
        })
      ])
    );

    await app.close();
  });

  it("generates client config and applies emergency controls", async () => {
    const app = createApiServer();
    const serverId = "00000000-0000-4000-8000-000000000100";

    const config = await app.inject({
      method: "POST",
      url: "/api/client-config/generate",
      payload: { client: "opencode", serverId }
    });
    const emergency = await app.inject({
      method: "POST",
      url: "/api/admin/emergency-deny",
      payload: {
        reason: "Integration test emergency",
        global: false,
        highCritical: true,
        serverIds: [serverId],
        toolNames: ["echo_message"],
        subjectIds: ["00000000-0000-4000-8000-000000000001"],
        clientIds: ["local-dev-client"]
      }
    });
    const revoke = await app.inject({
      method: "POST",
      url: `/api/admin/revoke-server-grants/${serverId}`
    });

    expect(config.statusCode).toBe(200);
    expect(config.json()).toMatchObject({ client: "opencode" });
    expect(emergency.json()).toMatchObject({
      enabled: true,
      global: false,
      highCritical: true,
      serverIds: [serverId],
      toolNames: ["echo_message"],
      subjectIds: ["00000000-0000-4000-8000-000000000001"],
      clientIds: ["local-dev-client"]
    });
    expect(revoke.json()).toMatchObject({ serverId });

    await app.close();
  });

  it("disables emergency deny and records an audit event", async () => {
    const app = createApiServer();

    const response = await app.inject({ method: "POST", url: "/api/admin/emergency-deny/disable", headers: { "x-trace-id": "emergency-disable-trace" } });
    const audit = await app.inject({ method: "GET", url: "/api/audit-events?trace_id=emergency-disable-trace&event_type=emergency_policy.disabled" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ enabled: false });
    expect(audit.json()).toMatchObject({ items: [expect.objectContaining({ eventType: "emergency_policy.disabled", policyDecision: "allow" })] });

    await app.close();
  });

  it("ingests Gateway audit events for API audit search", async () => {
    const app = createApiServer();
    const payload = {
      eventType: "tool.call.succeeded",
      traceId: "gateway-ingest-trace",
      userId: "gateway-user",
      clientId: "gateway-client",
      sessionId: "gateway-session",
      serverId: "00000000-0000-4000-8000-000000000100",
      toolName: "echo_message",
      riskLevel: "medium",
      policyDecision: "allow",
      argumentHash: "untrusted-hash-from-gateway",
      argumentRedactedJson: { token: "raw-token", nested: [null, { ok: true, apiKey: "raw-api-key", privateKey: "raw-private-key" }] },
      latencyMs: 15,
      upstreamStatus: 200
    };
    const expectedRedactedArguments = { token: "[REDACTED]", nested: [null, { ok: true, apiKey: "[REDACTED]", privateKey: "[REDACTED]" }] };

    const ingest = await app.inject({ method: "POST", url: "/api/audit-events/gateway", payload });
    const audit = await app.inject({ method: "GET", url: "/api/audit-events?trace_id=gateway-ingest-trace&risk_level=medium" });
    const auditBody = JSON.stringify(audit.json());

    expect(ingest.statusCode).toBe(201);
    expect(audit.json()).toMatchObject({
      items: [
        expect.objectContaining({
          eventType: "tool.call.succeeded",
          traceId: "gateway-ingest-trace",
          riskLevel: "medium",
          argumentHash: hashAuditArguments(expectedRedactedArguments),
          argumentRedactedJson: expectedRedactedArguments,
          latencyMs: 15,
          upstreamStatus: 200,
          metadataJson: expect.objectContaining({ source: "gateway" })
        })
      ]
    });
    expect(auditBody).not.toContain("raw-token");
    expect(auditBody).not.toContain("raw-api-key");
    expect(auditBody).not.toContain("raw-private-key");

    await app.close();
  });
});
