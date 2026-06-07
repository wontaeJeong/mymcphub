import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildRolloutStatusRows } from "../app/operations/page-helpers";
import { buildGrantStatus, buildToolTestOptions } from "../app/tools/page-helpers";
import { RolloutStatusTable } from "../components/tables";
import type { ApiGrant, ApiMcpServer, ApiMcpServerVersion, ApiMcpTool, ApiServerHealth } from "../lib/api";
import { buildPolicyTestCallInput, buildPolicyTestDisplayPayload, parseToolTestRef, redactPolicyTestPayload } from "../lib/policy-test";

const createdAt = "2026-06-07T09:00:00.000Z";
const updatedAt = "2026-06-07T10:00:00.000Z";

function buildServer(overrides: Partial<ApiMcpServer> = {}): ApiMcpServer {
  return {
    id: "server-prod-docs",
    slug: "prod-docs",
    displayName: "Production Docs",
    ownerTeamId: "team-platform",
    environment: "prod",
    transport: "streamable_http",
    enabled: true,
    published: true,
    quarantined: false,
    riskLevel: "high",
    createdAt,
    updatedAt,
    ...overrides
  };
}

function buildTool(overrides: Partial<ApiMcpTool> = {}): ApiMcpTool {
  return {
    id: "tool-search",
    serverId: "server-prod-docs",
    name: "docs.search",
    enabled: true,
    riskLevel: "high",
    inputSchema: { type: "object" },
    discoveredAt: createdAt,
    lastSeenAt: updatedAt,
    ...overrides
  };
}

function buildGrant(overrides: Partial<ApiGrant> = {}): ApiGrant {
  return {
    id: "grant-1",
    subjectType: "team",
    subjectId: "team-platform",
    projectId: "project-prod",
    serverId: "server-prod-docs",
    allowedTools: ["docs.search"],
    environment: "prod",
    reason: "incident response",
    enabled: true,
    createdAt,
    ...overrides
  };
}

function buildVersion(overrides: Partial<ApiMcpServerVersion> = {}): ApiMcpServerVersion {
  return {
    id: "version-1",
    serverId: "server-prod-docs",
    version: "2026.06.1",
    status: "active",
    imageRef: "ghcr.io/example/prod-docs:2026.06.1",
    createdAt,
    updatedAt,
    activatedAt: updatedAt,
    ...overrides
  };
}

function buildHealth(overrides: Partial<ApiServerHealth> = {}): ApiServerHealth {
  return {
    id: "health-1",
    serverId: "server-prod-docs",
    status: "healthy",
    latencyMs: 12,
    checkedAt: updatedAt,
    ...overrides
  };
}

describe("Lane C Web contract helpers", () => {
  it("builds tool test lab options and grant status from Go API shapes", () => {
    const server = buildServer();
    const tool = buildTool();
    const options = buildToolTestOptions([server], [tool]);
    const grantStatus = buildGrantStatus([tool], [buildGrant()]);
    const noGrantStatus = buildGrantStatus([tool], []);
    const unavailableGrantStatus = buildGrantStatus([tool], undefined);

    expect(options).toEqual([{ value: "server-prod-docs::prod-docs::docs.search", label: "Production Docs · docs.search", serverId: "server-prod-docs", serverSlug: "prod-docs", toolName: "docs.search", riskLevel: "high", enabled: true }]);
    expect(grantStatus.get("server-prod-docs:docs.search")).toBe("1개 활성 권한: 팀:team-platform");
    expect(noGrantStatus.get("server-prod-docs:docs.search")).toBe("활성 권한 없음");
    expect(unavailableGrantStatus.get("server-prod-docs:docs.search")).toBe("권한 상태 확인 불가");
  });

  it("creates dry-run policy test call payloads and redacts sensitive arguments", () => {
    const ref = parseToolTestRef("server-prod-docs::prod-docs::docs.search");
    const args = { query: "release", token: "secret-token", nested: { password: "secret-password" } };
    const input = buildPolicyTestCallInput(ref, args, true);
    const redacted = redactPolicyTestPayload(args);
    const displayPayload = buildPolicyTestDisplayPayload(input, {
      effect: "deny",
      allowed: false,
      reason: "Simulation requires a matching grant in the runtime store.",
      reasonCode: "DENY_BY_DEFAULT",
      matchedGrantIds: [],
      requiresApproval: false,
      requiresStepUp: false
    });
    const displayJson = JSON.stringify(displayPayload);

    expect(input.dryRun).toBe(true);
    expect(input.stepUp).toBe(true);
    expect(input.mcpRequest.method).toBe("tools/call");
    expect(input.mcpRequest.params.name).toBe("docs.search");
    expect(JSON.stringify(redacted)).toContain("[REDACTED]");
    expect(JSON.stringify(redacted)).not.toContain("secret-token");
    expect(JSON.stringify(redacted)).not.toContain("secret-password");
    expect(displayJson).toContain("DENY_BY_DEFAULT");
    expect(displayJson).toContain("[REDACTED]");
    expect(displayJson).not.toContain("secret-token");
    expect(displayJson).not.toContain("secret-password");
  });

  it("renders rollout and quarantine state from server, version, and health contracts", () => {
    const server = buildServer({ enabled: false, quarantined: true });
    const rows = buildRolloutStatusRows([server], new Map([[server.id, [buildVersion()]]]), new Map([[server.id, buildHealth({ status: "degraded" })]]));
    const html = renderToStaticMarkup(<RolloutStatusTable rows={rows} />);

    expect(html).toContain("Production Docs");
    expect(html).toContain("2026.06.1");
    expect(html).toContain("저하");
    expect(html).toContain("격리됨");
    expect(html).toContain("비활성");
  });
});
