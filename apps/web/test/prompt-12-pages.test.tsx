import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { splitApprovalQueue } from "../app/approvals/page-helpers";
import { buildAuditPageHref, filterToolCallEvents, readAuditOptions } from "../app/audit/page-helpers";
import { matchesCatalogFilters } from "../app/catalog/page-helpers";
import { AdminServerDetailPageContent as ServerDetailPage } from "../app/servers/[serverId]/content";
import { selectActiveServerVersion, selectRecentServerAuditEvents, selectServerHealth } from "../app/servers/[serverId]/page-helpers";
import { ApprovalTable, AuditTable, ServerTable, ServerVersionTable, ToolCallTable, ToolTable } from "../components/tables";
import type { ApiApproval, ApiAuditEvent, ApiMcpServer, ApiMcpServerVersion, ApiMcpTool, ApiServerHealth, ApiToolCallEvent } from "../lib/api";

const createdAt = "2026-06-07T09:00:00.000Z";
const updatedAt = "2026-06-07T10:00:00.000Z";

function buildServer(overrides: Partial<ApiMcpServer> = {}): ApiMcpServer {
  return {
    id: "server-prod-docs",
    slug: "prod-docs",
    displayName: "Production Docs",
    description: "Search production runbooks",
    ownerTeamId: "team-platform",
    environment: "prod",
    transport: "streamable_http",
    upstreamUrl: "https://docs.example.test/mcp",
    enabled: true,
    riskLevel: "high",
    schemaVersion: "2026-06",
    createdAt,
    updatedAt,
    ...overrides
  };
}

function buildHealth(overrides: Partial<ApiServerHealth> = {}): ApiServerHealth {
  return {
    id: "health-1",
    serverId: "server-prod-docs",
    status: "degraded",
    latencyMs: 153,
    errorMessage: "slow upstream",
    checkedAt: "2026-06-07T10:05:00.000Z",
    ...overrides
  };
}

function buildServerVersion(overrides: Partial<ApiMcpServerVersion> = {}): ApiMcpServerVersion {
  return {
    id: "version-1",
    serverId: "server-prod-docs",
    version: "2026.06.1",
    imageRef: "ghcr.io/example/prod-docs:2026.06.1",
    configHash: "sha256:config",
    toolSchemaHash: "sha256:schema",
    status: "active",
    createdBy: "user-release",
    createdAt,
    activatedAt: updatedAt,
    manifestJson: { name: "prod-docs" },
    ...overrides
  };
}

function jsonResponse(value: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: {
      "content-type": "application/json"
    }
  });
}

function stubServerDetailFetch(versionResult: { type: "items"; items: ApiMcpServerVersion[] } | { type: "error" }) {
  vi.stubGlobal("fetch", async (input: string | URL | Request) => {
    const url = input instanceof Request ? new URL(input.url) : input instanceof URL ? input : new URL(input);

    if (url.pathname === "/api/servers/server-prod-docs") {
      return jsonResponse(buildServer());
    }

    if (url.pathname === "/api/servers/server-prod-docs/tools") {
      return jsonResponse({ items: [] });
    }

    if (url.pathname === "/api/server-health") {
      return jsonResponse({ items: [buildHealth()] });
    }

    if (url.pathname === "/api/audit-events") {
      return jsonResponse({ items: [] });
    }

    if (url.pathname === "/api/servers/server-prod-docs/versions") {
      if (versionResult.type === "error") {
        return jsonResponse({ error: { message: "Versions endpoint unavailable" } }, { status: 503, statusText: "Service Unavailable" });
      }

      return jsonResponse({ items: versionResult.items });
    }

    return jsonResponse({ error: { message: `Unhandled test endpoint ${url.pathname}` } }, { status: 404, statusText: "Not Found" });
  });
}

function buildTool(overrides: Partial<ApiMcpTool> = {}): ApiMcpTool {
  return {
    id: "tool-search",
    serverId: "server-prod-docs",
    name: "docs.search",
    description: "Search internal documentation",
    enabled: false,
    riskLevel: "medium",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" }
      }
    },
    schemaVersion: "2026-06",
    discoveredAt: "2026-06-07T09:10:00.000Z",
    lastSeenAt: "2026-06-07T10:10:00.000Z",
    ...overrides
  };
}

function buildAuditEvent(overrides: Partial<ApiAuditEvent> = {}): ApiAuditEvent {
  return {
    id: "audit-1",
    timestamp: "2026-06-07T10:20:00.000Z",
    userId: "user-alice",
    teamId: "team-platform",
    projectId: "project-console",
    serverId: "server-prod-docs",
    toolName: "docs.search",
    eventType: "tool.call",
    riskLevel: "high",
    policyDecision: "needs_approval",
    traceId: "trace-prod-docs",
    metadataJson: { route: "catalog" },
    argumentHash: "sha256:catalog",
    argumentRedactedJson: { query: "release runbook" },
    latencyMs: 42,
    upstreamStatus: 202,
    ...overrides
  };
}

function buildApproval(overrides: Partial<ApiApproval> = {}): ApiApproval {
  return {
    id: "approval-1",
    requesterId: "user-alice",
    subjectType: "user",
    subjectId: "user-alice",
    projectId: "project-console",
    serverId: "server-prod-docs",
    requestedTools: ["docs.search"],
    environment: "prod",
    status: "pending",
    requestedAction: "tool.call",
    reason: "Investigate production release",
    ticketUrl: "https://tickets.example.test/MCP-12",
    requestedExpiresAt: "2026-06-08T10:00:00.000Z",
    createdAt,
    updatedAt,
    ...overrides
  };
}

function buildToolCallEvent(overrides: Partial<ApiToolCallEvent> = {}): ApiToolCallEvent {
  return {
    id: "call-1",
    auditEventId: "audit-1",
    serverId: "server-prod-docs",
    toolName: "docs.search",
    status: "failed",
    latencyMs: 87,
    createdAt: "2026-06-07T10:25:00.000Z",
    ...overrides
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("prompt-12 required web pages", () => {
  it("covers server catalog filtering and rendered catalog row state", () => {
    const matchingServer = buildServer();
    const disabledServer = buildServer({ id: "server-dev-ops", slug: "dev-ops", displayName: "Dev Ops", environment: "dev", enabled: false, riskLevel: "low" });
    const health = buildHealth();
    const filters = {
      q: "runbooks",
      environment: "prod",
      transport: "streamable_http",
      risk: "high",
      health: "degraded",
      enabled: "enabled"
    };

    expect(matchesCatalogFilters(matchingServer, health, filters)).toBe(true);
    expect(matchesCatalogFilters(disabledServer, undefined, filters)).toBe(false);

    const html = renderToStaticMarkup(<ServerTable servers={[matchingServer]} healthByServerId={new Map([[health.serverId, health]])} />);
    const adminHtml = renderToStaticMarkup(<ServerTable servers={[matchingServer]} healthByServerId={new Map([[health.serverId, health]])} audience="admin-summary" />);

    expect(html).toContain("Production Docs");
    expect(html).not.toContain("<td>prod-docs</td>");
    expect(html).not.toContain("team-platform");
    expect(html).not.toContain("스트리밍 HTTP");
    expect(html).toContain("저하");
    expect(html).toContain("활성");
    expect(adminHtml).toContain("prod-docs");
    expect(adminHtml).toContain("소유 팀 보기");
  });

  it("covers server detail health, recent audit, and tool schema behavior", () => {
    const selectedHealth = buildHealth();
    const olderAudit = buildAuditEvent({ id: "audit-older", traceId: "trace-older" });
    const latestAudit = buildAuditEvent({ id: "audit-latest", traceId: "trace-latest" });

    expect(selectServerHealth([buildHealth({ serverId: "other-server" }), selectedHealth], "server-prod-docs")).toEqual(selectedHealth);
    expect(selectRecentServerAuditEvents([latestAudit, olderAudit])).toEqual([latestAudit]);

    const toolsHtml = renderToStaticMarkup(<ToolTable tools={[buildTool()]} showSchema />);
    const adminToolsHtml = renderToStaticMarkup(<ToolTable tools={[buildTool()]} showSchema audience="admin-detail" />);
    const auditHtml = renderToStaticMarkup(<AuditTable events={selectRecentServerAuditEvents([latestAudit, olderAudit])} />);

    expect(toolsHtml).toContain("docs.search");
    expect(toolsHtml).toContain("Search internal documentation");
    expect(toolsHtml).not.toContain("스키마 보기");
    expect(adminToolsHtml).toContain("스키마 보기");
    expect(toolsHtml).toContain("비활성");
    expect(auditHtml).toContain("trace-latest");
    expect(auditHtml).not.toContain("trace-older");
  });


  it("covers server version active selection and table rendering", () => {
    const activeVersion = buildServerVersion({ id: "version-active", version: "2026.06.1", status: "active", createdAt: "2026-06-07T09:00:00.000Z" });
    const newerPendingVersion = buildServerVersion({ id: "version-pending", version: "2026.06.2", status: "pending", createdAt: "2026-06-07T11:00:00.000Z" });
    const newestFallbackVersion = buildServerVersion({ id: "version-draft", version: "2026.06.3", status: "draft", createdAt: "2026-06-07T12:00:00.000Z", imageRef: undefined, imageRepository: "ghcr.io/example/prod-docs", imageTag: "2026.06.3" });
    const rolledBackVersion = buildServerVersion({ id: "version-rolled-back", version: "2026.05.1", status: "rolled_back" });

    expect(selectActiveServerVersion([newerPendingVersion, activeVersion])).toEqual(activeVersion);
    expect(selectActiveServerVersion([newerPendingVersion, newestFallbackVersion])).toEqual(newestFallbackVersion);

    const html = renderToStaticMarkup(<ServerVersionTable versions={[activeVersion, newestFallbackVersion, rolledBackVersion]} />);

    expect(html).toContain("2026.06.1");
    expect(html).toContain("활성");
    expect(html).toContain("ghcr.io/example/prod-docs:2026.06.1");
    expect(html).toContain("sha256:config");
    expect(html).toContain("sha256:schema");
    expect(html).toContain("2026.06.3");
    expect(html).toContain("ghcr.io/example/prod-docs");
    expect(html).toContain("2026.05.1");
    expect(html).toContain("롤백됨");
  });

  it("renders server detail versions plus empty and error fallbacks without blocking the page", async () => {
    stubServerDetailFetch({ type: "items", items: [buildServerVersion(), buildServerVersion({ id: "version-pending", version: "2026.06.2", status: "pending", createdAt: "2026-06-07T11:00:00.000Z" })] });
    const versionPage = await ServerDetailPage({ params: Promise.resolve({ serverId: "server-prod-docs" }) });
    const versionHtml = renderToStaticMarkup(versionPage);

    expect(versionHtml).toContain("활성 버전");
    expect(versionHtml).toContain("2026.06.1");
    expect(versionHtml).toContain("2026.06.2");
    expect(versionHtml).toContain("서버 도구");

    stubServerDetailFetch({ type: "items", items: [] });
    const emptyPage = await ServerDetailPage({ params: Promise.resolve({ serverId: "server-prod-docs" }) });
    const emptyHtml = renderToStaticMarkup(emptyPage);

    expect(emptyHtml).toContain("Production Docs");
    expect(emptyHtml).toContain("서버 버전 없음");
    expect(emptyHtml).toContain("발견된 도구 없음");

    stubServerDetailFetch({ type: "error" });
    const errorPage = await ServerDetailPage({ params: Promise.resolve({ serverId: "server-prod-docs" }) });
    const errorHtml = renderToStaticMarkup(errorPage);

    expect(errorHtml).toContain("Production Docs");
    expect(errorHtml).toContain("서버 버전 사용 불가");
    expect(errorHtml).toContain("Versions endpoint unavailable (503)");
    expect(errorHtml).toContain("발견된 도구 없음");
  });

  it("covers approval queue partitioning and decision rendering", () => {
    const pending = buildApproval();
    const approved = buildApproval({ id: "approval-2", status: "approved", reviewerId: "reviewer-1", reviewComment: "Approved for incident response", decidedAt: "2026-06-07T11:00:00.000Z" });
    const queue = splitApprovalQueue([pending, approved]);

    expect(queue.pending).toEqual([pending]);
    expect(queue.decided).toEqual([approved]);

    const pendingHtml = renderToStaticMarkup(<ApprovalTable approvals={queue.pending} actionSlot={(approval) => <strong>Review {approval.id}</strong>} />);
    const decidedHtml = renderToStaticMarkup(<ApprovalTable approvals={queue.decided} />);

    expect(pendingHtml).toContain("사용자: user-alice");
    expect(pendingHtml).toContain("docs.search");
    expect(pendingHtml).toContain("Review approval-1");
    expect(decidedHtml).toContain("검토자 reviewer-1");
    expect(decidedHtml).toContain("Approved for incident response");
  });

  it("covers audit log server-side options, pagination hrefs, and tool call filtering", () => {
    const filters = {
      server: "prod-docs",
      tool: ["docs.search", "ignored"],
      status: "fail",
      event_type: "tool.call",
      policy_decision: "needs_approval",
      risk_level: "high",
      trace_id: "trace-prod-docs",
      limit: "25"
    };
    const options = readAuditOptions(filters);
    const nextHref = buildAuditPageHref(filters, "cursor-next");
    const matchingCall = buildToolCallEvent();
    const filteredCalls = filterToolCallEvents([
      matchingCall,
      buildToolCallEvent({ id: "call-2", serverId: "server-dev-ops", status: "ok" })
    ], filters);

    expect(options).toMatchObject({
      limit: 25,
      server: "prod-docs",
      tool: "docs.search",
      event_type: "tool.call",
      policy_decision: "needs_approval",
      risk_level: "high",
      trace_id: "trace-prod-docs"
    });
    expect(nextHref).toBe("/admin/audit?server=prod-docs&tool=docs.search&event_type=tool.call&policy_decision=needs_approval&risk_level=high&trace_id=trace-prod-docs&limit=25&status=fail&cursor=cursor-next");
    expect(filteredCalls).toEqual([matchingCall]);

    const auditHtml = renderToStaticMarkup(<AuditTable events={[buildAuditEvent()]} />);
    const callsHtml = renderToStaticMarkup(<ToolCallTable events={filteredCalls} serverNameById={new Map([["server-prod-docs", "Production Docs"]])} />);

    expect(auditHtml).toContain("승인 필요");
    expect(auditHtml).toContain("trace-prod-docs");
    expect(callsHtml).toContain("Production Docs");
    expect(callsHtml).toContain("실패");
    expect(callsHtml).toContain("87 ms");
  });
});
