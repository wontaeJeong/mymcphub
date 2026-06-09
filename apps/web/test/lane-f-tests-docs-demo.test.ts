import { describe, expect, it } from "vitest";

import { readAccessRequestDefaults, readAccessRequestPrefill } from "../app/access/page-helpers";
import { buildApprovalDecisionContexts, splitApprovalQueue } from "../app/approvals/page-helpers";
import { getMarketTags, matchesCatalogFilters } from "../app/catalog/page-helpers";
import { selectServerHealth } from "../app/servers/[serverId]/page-helpers";
import { deriveServerSummary, deriveUseCases } from "../app/user/servers/[serverId]/page-helpers";
import { buildAccessRequestHref, evaluateAccessStatus } from "../lib/access-status";
import type { ApiApproval, ApiGrant, ApiMcpServer, ApiMcpTool, ApiServerHealth, AuthContext } from "../lib/api";

const createdAt = "2026-06-07T09:00:00.000Z";
const updatedAt = "2026-06-07T10:00:00.000Z";

function buildServer(overrides: Partial<ApiMcpServer> = {}): ApiMcpServer {
  return {
    id: "server-k8s",
    slug: "k8s-readonly",
    displayName: "Kubernetes Readonly",
    description: "Read Kubernetes namespaces and pods.",
    ownerTeamId: "team-platform",
    environment: "prod",
    transport: "streamable_http",
    enabled: true,
    published: true,
    quarantined: false,
    riskLevel: "high",
    category: "cloud_infra",
    tags: ["kubernetes", "platform", ""],
    summary: "Read Kubernetes through the MCP Gateway.",
    useCases: ["Inspect namespaces", ""],
    installMethods: ["gateway"],
    trustLevel: "platform_supported",
    visibility: "published",
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function buildTool(overrides: Partial<ApiMcpTool> = {}): ApiMcpTool {
  return {
    id: "tool-list-namespaces",
    serverId: "server-k8s",
    name: "list_namespaces",
    description: "List namespaces",
    enabled: true,
    riskLevel: "high",
    inputSchema: { type: "object" },
    discoveredAt: createdAt,
    lastSeenAt: updatedAt,
    ...overrides,
  };
}

function buildGrant(overrides: Partial<ApiGrant> = {}): ApiGrant {
  return {
    id: "grant-k8s",
    subjectType: "team",
    subjectId: "team-platform",
    projectId: "project-local",
    serverId: "server-k8s",
    allowedTools: ["*"],
    environment: "shared",
    reason: "demo access",
    enabled: true,
    createdAt,
    ...overrides,
  };
}

function buildApproval(overrides: Partial<ApiApproval> = {}): ApiApproval {
  return {
    id: "approval-k8s",
    requesterId: "user-alice",
    subjectType: "team",
    subjectId: "team-platform",
    projectId: "project-local",
    serverId: "server-k8s",
    requestedTools: ["list_namespaces"],
    environment: "prod",
    status: "pending",
    requestedAction: "grant_access",
    reason: "demo request",
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function buildHealth(overrides: Partial<ApiServerHealth> = {}): ApiServerHealth {
  return {
    id: "health-k8s",
    serverId: "server-k8s",
    status: "healthy",
    checkedAt: updatedAt,
    ...overrides,
  };
}

function buildSession(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user-alice",
    principalType: "user",
    email: "alice@example.test",
    displayName: "Alice",
    teamIds: ["team-platform"],
    teams: ["platform"],
    groups: [],
    roles: [],
    clientId: "web-client",
    issuer: "mock-auth",
    audience: "mcp-hub",
    isAdmin: false,
    isPlatformAdmin: false,
    authSource: "mock",
    tokenIssuer: "mock-auth",
    projectId: "project-local",
    ...overrides,
  };
}

describe("Lane F integrated market tests/docs helpers", () => {
  it("connects catalog filtering with access query preselects", () => {
    const server = buildServer();
    const accessByServerId = new Map([[server.id, true]]);

    expect(getMarketTags(server)).toEqual(["kubernetes", "platform"]);
    expect(matchesCatalogFilters(server, buildHealth(), {
      q: "gateway",
      category: "cloud_infra",
      tag: "kube",
      trust: "verified_only",
      access: "accessible",
      visibility: "published",
      enabled: "enabled",
    }, { accessByServerId, defaultEnabledOnly: true, defaultVisibleOnly: true })).toBe(true);

    expect(readAccessRequestPrefill({
      serverId: server.id,
      tools: "list_namespaces, get_pod",
      environment: "prod",
      reason: "demo install",
    })).toEqual({
      serverId: server.id,
      requestedTools: "list_namespaces, get_pod",
      environment: "prod",
      reason: "demo install",
    });
    expect(readAccessRequestDefaults({ serverId: "missing", requestedTools: "list_pods", environment: "bad" }, [server])).toEqual({
      serverId: server.id,
      requestedTools: "list_pods",
      environment: "prod",
    });
  });

  it("keeps access status and approval decision context aligned", () => {
    const server = buildServer();
    const tool = buildTool();
    const pendingApproval = buildApproval();
    const wildcardGrant = buildGrant();

    const pendingStatus = evaluateAccessStatus({
      server,
      tool,
      grants: [],
      approvals: [pendingApproval],
      session: buildSession(),
      health: buildHealth({ status: "degraded" }),
    });
    const contexts = buildApprovalDecisionContexts(
      [pendingApproval],
      [server],
      new Map([[server.id, [tool]]]),
      [wildcardGrant],
    );
    const context = contexts.get(pendingApproval.id);

    expect(pendingStatus.status).toBe("pending_approval");
    expect(splitApprovalQueue([pendingApproval, buildApproval({ id: "approval-approved", status: "approved" })])).toEqual({
      pending: [pendingApproval],
      decided: [expect.objectContaining({ id: "approval-approved" })],
    });
    expect(context?.reviewCommentRequired).toBe(true);
    expect(context?.requestedToolRisks).toEqual([{ toolName: tool.name, riskLevel: "high", enabled: true }]);
    expect(context?.grantOverlaps).toEqual([{ grantId: wildcardGrant.id, subjectId: wildcardGrant.subjectId, allowedTools: ["*"], wildcard: true }]);
    expect(buildAccessRequestHref({ serverId: server.id, tools: [tool.name], environment: server.environment, reason: "demo" })).toBe("/user/access?serverId=server-k8s&tools=list_namespaces&environment=prod&reason=demo");
  });

  it("uses newest health checks and safe optional market metadata fallbacks", () => {
    const stale = buildHealth({ id: "health-stale", status: "unhealthy", checkedAt: "2026-06-07T08:00:00.000Z" });
    const latest = buildHealth({ id: "health-latest", status: "healthy", checkedAt: "2026-06-07T11:00:00.000Z" });
    const other = buildHealth({ id: "health-other", serverId: "server-other", status: "degraded", checkedAt: "2026-06-07T12:00:00.000Z" });
    const serverWithoutOptionalMetadata = buildServer({ summary: undefined, useCases: undefined });

    expect(selectServerHealth([stale, other, latest], "server-k8s")).toBe(latest);
    expect(deriveServerSummary(serverWithoutOptionalMetadata)).toBe("Read Kubernetes namespaces and pods.");
    expect(deriveUseCases(serverWithoutOptionalMetadata, [buildTool({ description: "List Kubernetes namespaces" })])).toEqual({
      items: ["list_namespaces: List Kubernetes namespaces"],
      source: "tools",
    });
  });
});
