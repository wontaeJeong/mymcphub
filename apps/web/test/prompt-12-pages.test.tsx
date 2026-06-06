import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { splitApprovalQueue } from "../app/approvals/page-helpers";
import { buildAuditPageHref, filterToolCallEvents, readAuditOptions } from "../app/audit/page-helpers";
import { matchesCatalogFilters } from "../app/catalog/page-helpers";
import { selectRecentServerAuditEvents, selectServerHealth } from "../app/servers/[serverId]/page-helpers";
import { ApprovalTable, AuditTable, ServerTable, ToolCallTable, ToolTable } from "../components/tables";
import type { ApiApproval, ApiAuditEvent, ApiMcpServer, ApiMcpTool, ApiServerHealth, ApiToolCallEvent } from "../lib/api";

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

    expect(html).toContain("Production Docs");
    expect(html).toContain("prod-docs");
    expect(html).toContain("team-platform");
    expect(html).toContain("streamable_http");
    expect(html).toContain("degraded");
    expect(html).toContain("enabled");
  });

  it("covers server detail health, recent audit, and tool schema behavior", () => {
    const selectedHealth = buildHealth();
    const olderAudit = buildAuditEvent({ id: "audit-older", traceId: "trace-older" });
    const latestAudit = buildAuditEvent({ id: "audit-latest", traceId: "trace-latest" });

    expect(selectServerHealth([buildHealth({ serverId: "other-server" }), selectedHealth], "server-prod-docs")).toEqual(selectedHealth);
    expect(selectRecentServerAuditEvents([latestAudit, olderAudit])).toEqual([latestAudit]);

    const toolsHtml = renderToStaticMarkup(<ToolTable tools={[buildTool()]} showSchema />);
    const auditHtml = renderToStaticMarkup(<AuditTable events={selectRecentServerAuditEvents([latestAudit, olderAudit])} />);

    expect(toolsHtml).toContain("docs.search");
    expect(toolsHtml).toContain("Search internal documentation");
    expect(toolsHtml).toContain("View schema");
    expect(toolsHtml).toContain("disabled");
    expect(auditHtml).toContain("trace-latest");
    expect(auditHtml).not.toContain("trace-older");
  });

  it("covers approval queue partitioning and decision rendering", () => {
    const pending = buildApproval();
    const approved = buildApproval({ id: "approval-2", status: "approved", reviewerId: "reviewer-1", reviewComment: "Approved for incident response", decidedAt: "2026-06-07T11:00:00.000Z" });
    const queue = splitApprovalQueue([pending, approved]);

    expect(queue.pending).toEqual([pending]);
    expect(queue.decided).toEqual([approved]);

    const pendingHtml = renderToStaticMarkup(<ApprovalTable approvals={queue.pending} actionSlot={(approval) => <strong>Review {approval.id}</strong>} />);
    const decidedHtml = renderToStaticMarkup(<ApprovalTable approvals={queue.decided} />);

    expect(pendingHtml).toContain("user: user-alice");
    expect(pendingHtml).toContain("docs.search");
    expect(pendingHtml).toContain("Review approval-1");
    expect(decidedHtml).toContain("Reviewer reviewer-1");
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
    expect(nextHref).toBe("/audit?server=prod-docs&tool=docs.search&event_type=tool.call&policy_decision=needs_approval&risk_level=high&trace_id=trace-prod-docs&limit=25&status=fail&cursor=cursor-next");
    expect(filteredCalls).toEqual([matchingCall]);

    const auditHtml = renderToStaticMarkup(<AuditTable events={[buildAuditEvent()]} />);
    const callsHtml = renderToStaticMarkup(<ToolCallTable events={filteredCalls} serverNameById={new Map([["server-prod-docs", "Production Docs"]])} />);

    expect(auditHtml).toContain("needs_approval");
    expect(auditHtml).toContain("trace-prod-docs");
    expect(callsHtml).toContain("Production Docs");
    expect(callsHtml).toContain("failed");
    expect(callsHtml).toContain("87 ms");
  });
});
