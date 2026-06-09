import { describe, expect, it } from "vitest";

import type { ApiGrant, ApiMcpServer, ApiServerHealth, AuthContext } from "../../lib/api";
import {
  buildMarketSections,
  buildMarketSummary,
  buildPrincipalSubjectIds,
  buildServerAccessMap,
  getMarketCategory,
  getMarketSummary,
  getMarketTrustLevel,
  getMarketVisibility,
  matchesCatalogFilters,
} from "./page-helpers";

const createdAt = "2026-06-07T09:00:00.000Z";
const updatedAt = "2026-06-07T10:00:00.000Z";

function buildServer(overrides: Partial<ApiMcpServer> = {}): ApiMcpServer {
  return {
    id: "server-docs",
    slug: "internal-docs",
    displayName: "Internal Docs",
    description: "Search internal runbooks and documents.",
    ownerTeamId: "team-platform",
    environment: "prod",
    transport: "streamable_http",
    enabled: true,
    published: true,
    quarantined: false,
    riskLevel: "medium",
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function buildHealth(overrides: Partial<ApiServerHealth> = {}): ApiServerHealth {
  return {
    id: "health-docs",
    serverId: "server-docs",
    status: "healthy",
    checkedAt: updatedAt,
    ...overrides,
  };
}

function buildGrant(overrides: Partial<ApiGrant> = {}): ApiGrant {
  return {
    id: "grant-docs",
    subjectType: "team",
    subjectId: "team-platform",
    projectId: "project-prod",
    serverId: "server-docs",
    allowedTools: ["docs.search"],
    environment: "prod",
    reason: "documentation access",
    enabled: true,
    createdAt,
    ...overrides,
  };
}

function buildPrincipal(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user-alice",
    principalType: "user",
    email: "alice@example.test",
    displayName: "Alice",
    teamIds: ["team-platform"],
    teams: ["platform"],
    groups: ["docs-readers"],
    roles: [],
    clientId: "client-web",
    issuer: "dev",
    audience: "mcp-hub",
    isAdmin: false,
    isPlatformAdmin: false,
    authSource: "mock",
    tokenIssuer: "dev",
    projectId: "project-prod",
    ...overrides,
  };
}

describe("catalog page helpers", () => {
  it("matches category, tag, verified trust, access, and visibility filters", () => {
    const server = buildServer({
      category: "knowledge_docs",
      tags: ["docs", "runbooks"],
      summary: "Find production runbooks quickly.",
      trustLevel: "verified",
      visibility: "published",
    });
    const accessByServerId = new Map([[server.id, true]]);

    expect(matchesCatalogFilters(server, buildHealth(), {
      category: "knowledge_docs",
      tag: "run",
      trust: "verified_only",
      access: "accessible",
      visibility: "published",
    }, { accessByServerId, defaultEnabledOnly: true, defaultVisibleOnly: true })).toBe(true);

    expect(matchesCatalogFilters(server, buildHealth(), { tag: "database" }, { accessByServerId })).toBe(false);
    expect(matchesCatalogFilters(server, buildHealth(), { access: "request_required" }, { accessByServerId })).toBe(false);
  });

  it("falls back when optional market metadata is missing", () => {
    const server = buildServer({
      category: undefined,
      tags: undefined,
      summary: undefined,
      trustLevel: undefined,
      visibility: undefined,
      published: undefined,
    });

    expect(getMarketCategory(server)).toBe("other");
    expect(getMarketSummary(server)).toBe("Search internal runbooks and documents.");
    expect(getMarketTrustLevel(server)).toBe("community");
    expect(getMarketVisibility(server)).toBe("internal");
    expect(matchesCatalogFilters(server, undefined, { category: "other", trust: "community", visibility: "internal" }, { defaultEnabledOnly: true, defaultVisibleOnly: true })).toBe(true);
  });

  it("supports the unavailable health filter", () => {
    const server = buildServer();

    expect(matchesCatalogFilters(server, undefined, { health: "unavailable" })).toBe(true);
    expect(matchesCatalogFilters(server, buildHealth({ status: "healthy" }), { health: "unavailable" })).toBe(false);
  });

  it("keeps user defaults focused on active visible servers while preserving explicit overrides", () => {
    const hidden = buildServer({ id: "server-hidden", published: false });
    const disabled = buildServer({ id: "server-disabled", enabled: false });
    const quarantined = buildServer({ id: "server-quarantined", quarantined: true });

    expect(matchesCatalogFilters(hidden, undefined, {}, { defaultEnabledOnly: true, defaultVisibleOnly: true })).toBe(false);
    expect(matchesCatalogFilters(hidden, undefined, {})).toBe(true);
    expect(matchesCatalogFilters(disabled, undefined, {}, { defaultEnabledOnly: true, defaultVisibleOnly: true })).toBe(false);
    expect(matchesCatalogFilters(disabled, undefined, { enabled: "disabled" }, { defaultEnabledOnly: true, defaultVisibleOnly: true })).toBe(true);
    expect(matchesCatalogFilters(quarantined, undefined, { visibility: "quarantined" }, { defaultEnabledOnly: true, defaultVisibleOnly: true })).toBe(true);
  });

  it("builds access from current principal subjects and matching environment", () => {
    const server = buildServer();
    const principal = buildPrincipal();
    const subjectIds = buildPrincipalSubjectIds(principal);

    expect(subjectIds.has("team-platform")).toBe(true);
    expect(subjectIds.has("docs-readers")).toBe(true);
    expect(buildServerAccessMap([server], [buildGrant()], principal).get(server.id)).toBe(true);
    expect(buildServerAccessMap([server], [buildGrant({ environment: "dev" })], principal).get(server.id)).toBe(false);
  });

  it("summarizes and sections market servers without ranking semantics", () => {
    const verified = buildServer({ id: "server-verified", trustLevel: "official", publishedAt: "2026-06-09T09:00:00.000Z" });
    const requestRequired = buildServer({ id: "server-request", trustLevel: "community", publishedAt: "2026-06-08T09:00:00.000Z" });
    const hidden = buildServer({ id: "server-hidden", published: false });
    const disabled = buildServer({ id: "server-disabled", enabled: false });
    const accessByServerId = new Map([[verified.id, true], [requestRequired.id, false]]);
    const healthByServerId = new Map([
      [verified.id, buildHealth({ serverId: verified.id, status: "healthy" })],
      [requestRequired.id, buildHealth({ serverId: requestRequired.id, status: "degraded" })],
    ]);

    expect(buildMarketSummary([verified, requestRequired, hidden, disabled], healthByServerId, accessByServerId)).toEqual({
      publishedActiveServers: 2,
      accessibleServers: 1,
      requestRequiredServers: 1,
      statusIssueServers: 1,
    });

    const sections = buildMarketSections([requestRequired, hidden, verified, disabled], accessByServerId);
    expect(sections.verified.map((server) => server.id)).toEqual([verified.id]);
    expect(sections.recent.map((server) => server.id)).toEqual([verified.id, requestRequired.id]);
    expect(sections.accessible.map((server) => server.id)).toEqual([verified.id]);
    expect(sections.requestRequired.map((server) => server.id)).toEqual([requestRequired.id]);
  });
});
