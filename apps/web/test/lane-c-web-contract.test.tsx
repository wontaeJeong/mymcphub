import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { readAccessRequestDefaults } from "../app/access/page-helpers";
import { readClientConfigInitialValues } from "../app/client-config/page-helpers";
import { buildRolloutStatusRows } from "../app/operations/page-helpers";
import { buildGrantStatus, buildToolTestOptions } from "../app/tools/page-helpers";
import {
  buildAccessRequestHref,
  buildUserToolAccessStatus,
  deriveServerSummary,
  deriveUseCases,
} from "../app/user/servers/[serverId]/page-helpers";
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
  it("reads client config and access preselect query values with safe fallbacks", () => {
    const server = buildServer();
    const fallbackServer = buildServer({ id: "server-fallback", slug: "fallback", displayName: "Fallback" });

    expect(readClientConfigInitialValues({ serverId: server.id, client: "codex", profile: "prod" }, [server, fallbackServer])).toEqual({ serverId: server.id, client: "codex", profile: "prod" });
    expect(readClientConfigInitialValues({ serverId: "missing", client: "unsupported", profile: " " }, [server])).toEqual({ serverId: server.id, client: "opencode", profile: "local" });
    expect(readAccessRequestDefaults({ serverId: server.id, requestedTools: "docs.search, docs.read", environment: "prod" }, [server])).toEqual({ serverId: server.id, requestedTools: "docs.search, docs.read", environment: "prod" });
    expect(readAccessRequestDefaults({ environment: "not-real" }, [server])).toEqual({ serverId: server.id, requestedTools: "", environment: "prod" });
  });

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
    expect(unavailableGrantStatus.get("server-prod-docs:docs.search")).toBe("권한 정보 없음");
  });

  it("builds user detail access statuses and request links", () => {
    const server = buildServer();
    const tool = buildTool();
    const grantedStatus = buildUserToolAccessStatus(server, [tool], [buildGrant()]);
    const requestStatus = buildUserToolAccessStatus(server, [tool], []);
    const disabledToolStatus = buildUserToolAccessStatus(server, [buildTool({ enabled: false })], []);
    const unknownStatus = buildUserToolAccessStatus(server, [tool], undefined);
    const disabledServerStatus = buildUserToolAccessStatus(buildServer({ enabled: false }), [tool], [buildGrant()]);

    expect(grantedStatus.get("server-prod-docs:docs.search")).toBe("사용 가능");
    expect(requestStatus.get("server-prod-docs:docs.search")).toBe("권한 필요");
    expect(disabledToolStatus.get("server-prod-docs:docs.search")).toBe("사용 불가: 도구 비활성");
    expect(unknownStatus.get("server-prod-docs:docs.search")).toBe("권한 정보 없음");
    expect(disabledServerStatus.get("server-prod-docs:docs.search")).toBe("사용 불가: 서버 비활성");
    expect(buildAccessRequestHref(server, ["docs.search", "docs.read"])).toBe("/user/access?serverId=server-prod-docs&requestedTools=docs.search%2Cdocs.read&environment=prod");
  });

  it("derives optional market detail metadata without requiring Lane A fields", () => {
    const tool = buildTool({ description: "Search incident runbooks" });

    expect(deriveServerSummary(buildServer({ summary: "Find production docs", description: "Longer details" }))).toBe("Find production docs");
    expect(deriveServerSummary(buildServer({ description: "Longer details" }))).toBe("Longer details");
    expect(deriveServerSummary(buildServer())).toBe("공개된 서버 설명이 없습니다.");
    expect(deriveUseCases(buildServer({ useCases: ["Investigate incidents", " "] }), [tool])).toEqual({ items: ["Investigate incidents"], source: "metadata" });
    expect(deriveUseCases(buildServer(), [tool])).toEqual({ items: ["docs.search: Search incident runbooks"], source: "tools" });
    expect(deriveUseCases(buildServer(), [buildTool({ description: undefined })])).toEqual({ items: [], source: "empty" });
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
