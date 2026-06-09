import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { readAccessRequestPrefill } from "../app/access/page-helpers";
import { buildApprovalDecisionContexts } from "../app/approvals/page-helpers";
import { ApprovalTable, ToolTable } from "../components/tables";
import {
  buildAccessRequestHref,
  buildToolAccessStatusMap,
  evaluateAccessStatus,
} from "../lib/access-status";
import type { ApiApproval, ApiGrant, ApiMcpServer, ApiMcpTool, ApiServerHealth, AuthContext } from "../lib/api";

const createdAt = "2026-06-07T09:00:00.000Z";
const updatedAt = "2026-06-07T10:00:00.000Z";

function buildSession(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user-alice",
    principalType: "user",
    email: "alice@example.test",
    displayName: "Alice",
    teamIds: ["team-platform"],
    teams: ["team-platform"],
    groups: [],
    roles: [],
    clientId: "web-client",
    issuer: "mock-auth",
    audience: "mcp-hub",
    isAdmin: false,
    isPlatformAdmin: false,
    authSource: "mock",
    tokenIssuer: "mock-auth",
    projectId: "project-console",
    ...overrides,
  };
}

function buildServer(overrides: Partial<ApiMcpServer> = {}): ApiMcpServer {
  return {
    id: "server-prod-docs",
    slug: "prod-docs",
    displayName: "Production Docs",
    description: "Search production runbooks",
    ownerTeamId: "team-platform",
    environment: "prod",
    transport: "streamable_http",
    enabled: true,
    published: true,
    quarantined: false,
    riskLevel: "high",
    category: "knowledge_docs",
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function buildTool(overrides: Partial<ApiMcpTool> = {}): ApiMcpTool {
  return {
    id: "tool-search",
    serverId: "server-prod-docs",
    name: "docs.search",
    description: "Search internal documentation",
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
    id: "grant-1",
    subjectType: "team",
    subjectId: "team-platform",
    projectId: "project-console",
    serverId: "server-prod-docs",
    allowedTools: ["*"],
    environment: "prod",
    reason: "incident response",
    enabled: true,
    createdAt,
    ...overrides,
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
    requestedAction: "grant_access",
    reason: "Investigate production release",
    requestedExpiresAt: "2026-06-08T10:00:00.000Z",
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function buildHealth(overrides: Partial<ApiServerHealth> = {}): ApiServerHealth {
  return {
    id: "health-1",
    serverId: "server-prod-docs",
    status: "healthy",
    checkedAt: updatedAt,
    ...overrides,
  };
}

describe("Lane E safety governance UX helpers", () => {
  it("computes accessible, pending, disabled, and request-required states from one helper", () => {
    const session = buildSession();
    const server = buildServer();
    const tool = buildTool();

    const accessible = evaluateAccessStatus({
      server,
      tool,
      grants: [buildGrant()],
      approvals: [],
      session,
      health: buildHealth(),
    });
    const pending = evaluateAccessStatus({
      server,
      tool,
      grants: [],
      approvals: [buildApproval()],
      session,
      health: buildHealth({ status: "degraded" }),
    });
    const disabled = evaluateAccessStatus({
      server: buildServer({ enabled: false }),
      tool,
      grants: [buildGrant()],
      approvals: [],
      session,
    });
    const requestRequired = evaluateAccessStatus({
      server,
      tool,
      grants: [],
      approvals: [],
      session,
      health: buildHealth(),
    });

    expect(accessible.status).toBe("accessible");
    expect(accessible.wildcardGrant).toBe(true);
    expect(accessible.actionHint).toContain("전체 도구 권한(*)");
    expect(pending.status).toBe("pending_approval");
    expect(pending.label).toBe("승인 대기 중");
    expect(disabled.status).toBe("disabled");
    expect(requestRequired.status).toBe("request_required");
  });

  it("prefills user access requests and renders high-risk request copy", () => {
    const server = buildServer();
    const tool = buildTool();
    const prefill = readAccessRequestPrefill({
      serverId: server.id,
      tools: "docs.search, docs.read",
      environment: "prod",
      reason: "release support",
    });
    const href = buildAccessRequestHref({
      serverId: server.id,
      toolName: tool.name,
      environment: server.environment,
      reason: "need docs",
    });
    const statusByToolKey = buildToolAccessStatusMap([tool], {
      server,
      grants: [],
      approvals: [],
      session: buildSession(),
      health: buildHealth(),
    });
    const html = renderToStaticMarkup(
      <ToolTable
        tools={[tool]}
        accessStatusByToolKey={statusByToolKey}
        showAccess
        accessActionSlot={() => <a href={href}>접근 요청</a>}
      />,
    );

    expect(prefill).toEqual({
      serverId: "server-prod-docs",
      requestedTools: "docs.search, docs.read",
      environment: "prod",
      reason: "release support",
    });
    expect(href).toContain("/user/access?");
    expect(href).toContain("toolName=docs.search");
    expect(html).toContain("권한 필요");
    expect(html).toContain("높은 위험 도구");
    expect(html).toContain("접근 요청");
  });

  it("builds admin approval context with requested tool risk and wildcard grant overlap", () => {
    const server = buildServer();
    const tool = buildTool({ riskLevel: "critical" });
    const approval = buildApproval({ requestedTools: ["docs.search"] });
    const contexts = buildApprovalDecisionContexts(
      [approval],
      [server],
      new Map([[server.id, [tool]]]),
      [buildGrant({ subjectType: "user", subjectId: "user-alice" })],
    );
    const context = contexts.get(approval.id);
    const html = renderToStaticMarkup(
      <ApprovalTable
        approvals={[approval]}
        serverNameById={new Map([[server.id, server.displayName]])}
        contextByApprovalId={contexts}
      />,
    );

    expect(context?.reviewCommentRequired).toBe(true);
    expect(context?.grantOverlaps[0]?.wildcard).toBe(true);
    expect(html).toContain("Production Docs");
    expect(html).toContain("심각");
    expect(html).toContain("전체 도구 권한(*) 포함");
    expect(html).toContain("높음/심각 위험 요청");
  });
});
