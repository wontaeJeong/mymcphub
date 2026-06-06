import { randomUUID } from "node:crypto";

import { McpGrantSchema, McpServerManifestSchema, seedIds } from "@mcp-hub/db";

import { notFound, validationError } from "./errors";
import type {
  ApiApproval,
  ApiAuditEvent,
  ApiEmergencyPolicyState,
  ApiGrant,
  ApiMcpServer,
  ApiMcpTool,
  ApiServerHealth,
  ApiToolCallEvent,
  AuthContext,
  GrantSubjectType,
  ListResponse
} from "./types";

type StoreState = {
  servers: ApiMcpServer[];
  tools: ApiMcpTool[];
  grants: ApiGrant[];
  approvals: ApiApproval[];
  auditEvents: ApiAuditEvent[];
  toolCallEvents: ApiToolCallEvent[];
  serverHealth: ApiServerHealth[];
  emergencyDeny?: ApiEmergencyPolicyState;
};

export type ControlPlaneStore = ReturnType<typeof createControlPlaneStore>;

export function createControlPlaneStore(initialState = createSeedState()) {
  const state = initialState;

  return {
    listServers: () => ({ items: state.servers }),
    createServer: (body: unknown, auth: AuthContext) => {
      const manifest = McpServerManifestSchema.parse(body);
      const now = currentTimestamp();
      const server: ApiMcpServer = {
        id: randomUUID(),
        slug: manifest.slug,
        displayName: manifest.displayName,
        description: manifest.description,
        ownerTeamId: manifest.ownerTeamId,
        environment: manifest.environment,
        transport: manifest.transport,
        upstreamUrl: manifest.upstreamUrl,
        enabled: manifest.enabled,
        riskLevel: manifest.riskLevel,
        createdAt: now,
        updatedAt: now
      };

      state.servers.push(server);
      for (const tool of manifest.tools) {
        state.tools.push({
          id: randomUUID(),
          serverId: server.id,
          name: tool.name,
          description: tool.description,
          enabled: tool.enabled,
          riskLevel: tool.riskLevel,
          discoveredAt: now
        });
      }
      recordAudit(state, auth, "mcp_server.created", server.id, undefined, "allow");
      return server;
    },
    getServer: (serverId: string) => findServer(state, serverId),
    patchServer: (serverId: string, body: unknown, auth: AuthContext) => {
      const server = findServer(state, serverId);
      const patch = recordBody(body);

      if (typeof patch.displayName === "string") {
        server.displayName = patch.displayName;
      }
      if (typeof patch.description === "string") {
        server.description = patch.description;
      }
      if (typeof patch.enabled === "boolean") {
        server.enabled = patch.enabled;
      }
      server.updatedAt = currentTimestamp();
      recordAudit(state, auth, "mcp_server.updated", server.id, undefined, "allow");
      return server;
    },
    setServerEnabled: (serverId: string, enabled: boolean, auth: AuthContext) => {
      const server = findServer(state, serverId);
      server.enabled = enabled;
      server.updatedAt = currentTimestamp();
      recordAudit(state, auth, enabled ? "mcp_server.enabled" : "mcp_server.disabled", server.id, undefined, "allow");
      return server;
    },
    listTools: (serverId: string) => {
      findServer(state, serverId);
      return { items: state.tools.filter((tool) => tool.serverId === serverId) };
    },
    patchTool: (serverId: string, toolId: string, body: unknown, auth: AuthContext) => {
      findServer(state, serverId);
      const tool = findTool(state, toolId);
      const patch = recordBody(body);

      if (typeof patch.description === "string") {
        tool.description = patch.description;
      }
      if (typeof patch.enabled === "boolean") {
        tool.enabled = patch.enabled;
      }
      if (isRiskLevel(patch.riskLevel)) {
        tool.riskLevel = patch.riskLevel;
      }
      tool.lastSeenAt = currentTimestamp();
      recordAudit(state, auth, "mcp_tool.updated", serverId, tool.name, "allow");
      return tool;
    },
    setToolEnabled: (serverId: string, toolId: string, enabled: boolean, auth: AuthContext) => {
      const tool = findTool(state, toolId);
      tool.enabled = enabled;
      tool.lastSeenAt = currentTimestamp();
      recordAudit(state, auth, enabled ? "mcp_tool.enabled" : "mcp_tool.disabled", serverId, tool.name, "allow");
      return tool;
    },
    listGrants: () => ({ items: state.grants }),
    createGrant: (body: unknown, auth: AuthContext) => {
      const input = McpGrantSchema.parse(body);
      findServer(state, input.serverId);
      const grant: ApiGrant = {
        id: randomUUID(),
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        projectId: input.projectId,
        serverId: input.serverId,
        allowedTools: input.allowedTools,
        environment: input.environment,
        expiresAt: input.expiresAt,
        approvedBy: input.approvedBy ?? auth.userId,
        reason: input.reason,
        ticketUrl: input.ticketUrl,
        enabled: input.enabled,
        createdAt: currentTimestamp()
      };
      state.grants.push(grant);
      recordAudit(state, auth, "mcp_grant.created", grant.serverId, undefined, "allow");
      return grant;
    },
    patchGrant: (grantId: string, body: unknown, auth: AuthContext) => {
      const grant = findGrant(state, grantId);
      const patch = recordBody(body);

      if (typeof patch.enabled === "boolean") {
        grant.enabled = patch.enabled;
      }
      if (Array.isArray(patch.allowedTools) && patch.allowedTools.every((tool) => typeof tool === "string")) {
        grant.allowedTools = patch.allowedTools;
      }
      recordAudit(state, auth, "mcp_grant.updated", grant.serverId, undefined, "allow");
      return grant;
    },
    revokeGrant: (grantId: string, auth: AuthContext) => {
      const grant = findGrant(state, grantId);
      grant.enabled = false;
      recordAudit(state, auth, "mcp_grant.revoked", grant.serverId, undefined, "allow");
      return grant;
    },
    listApprovals: () => ({ items: state.approvals }),
    createApproval: (body: unknown, auth: AuthContext) => {
      const input = recordBody(body);
      const serverId = requiredString(input.serverId, "serverId");
      const server = findServer(state, serverId);
      const now = currentTimestamp();
      const requestedTools = readRequestedTools(input);
      const approval: ApiApproval = {
        id: randomUUID(),
        requesterId: auth.userId,
        subjectType: readSubjectType(input.subjectType) ?? "user",
        subjectId: optionalString(input.subjectId) ?? auth.userId,
        projectId: requiredString(input.projectId, "projectId"),
        serverId,
        requestedTools,
        environment: readEnvironment(input.environment) ?? server.environment,
        toolName: optionalString(input.toolName) ?? requestedTools[0],
        status: "pending",
        requestedAction: optionalString(input.requestedAction) ?? "call_tool",
        reason: requiredString(input.reason, "reason"),
        ticketUrl: optionalUrl(input.ticketUrl, "ticketUrl"),
        requestedExpiresAt: optionalDateTime(input.requestedExpiresAt, "requestedExpiresAt"),
        createdAt: now,
        updatedAt: now
      };
      state.approvals.push(approval);
      recordAudit(state, auth, "approval.created", approval.serverId, approval.toolName, "needs_approval");
      return approval;
    },
    decideApproval: (approvalId: string, decision: "approved" | "rejected", auth: AuthContext, body: unknown = {}) => {
      const approval = findApproval(state, approvalId);
      if (approval.status !== "pending") {
        throw validationError("Approval has already been decided", { status: approval.status });
      }
      const input = recordBody(body);
      const now = currentTimestamp();
      const reviewerId = optionalString(input.reviewerId) ?? auth.userId;
      approval.status = decision;
      approval.reviewerId = reviewerId;
      approval.reviewComment = optionalString(input.reviewComment);
      approval.decidedBy = reviewerId;
      approval.decidedAt = now;
      approval.updatedAt = now;
      if (decision === "approved") {
        const grant = createGrantFromApproval(approval, input, reviewerId, now);
        state.grants.push(grant);
      }
      recordAudit(state, auth, `approval.${decision}`, approval.serverId, approval.toolName, decision === "approved" ? "allow" : "deny");
      return approval;
    },
    listAuditEvents: (limit: number, cursor?: string): ListResponse<ApiAuditEvent> => paginate(state.auditEvents, limit, cursor),
    listToolCallEvents: () => ({ items: state.toolCallEvents }),
    listServerHealth: () => ({ items: state.serverHealth }),
    enableEmergencyDeny: (body: unknown, auth: AuthContext) => {
      const input = typeof body === "string" ? { reason: body } : recordBody(body);
      state.emergencyDeny = {
        enabled: true,
        reason: requiredString(input.reason, "reason"),
        global: readBoolean(input.global) ?? !hasEmergencyScope(input),
        highCritical: readBoolean(input.highCritical) ?? false,
        serverIds: readStringArray(input.serverIds),
        serverSlugs: readStringArray(input.serverSlugs),
        toolNames: readStringArray(input.toolNames),
        subjectIds: readStringArray(input.subjectIds),
        clientIds: readStringArray(input.clientIds),
        createdAt: currentTimestamp()
      };
      recordAudit(state, auth, "admin.emergency_deny.enabled", undefined, undefined, "deny");
      return state.emergencyDeny;
    },
    revokeServerGrants: (serverId: string, auth: AuthContext) => {
      findServer(state, serverId);
      let revoked = 0;
      for (const grant of state.grants) {
        if (grant.serverId === serverId && grant.enabled) {
          grant.enabled = false;
          revoked += 1;
        }
      }
      recordAudit(state, auth, "admin.server_grants.revoked", serverId, undefined, "deny");
      return { revoked, serverId };
    }
  };
}

function createSeedState(): StoreState {
  const now = currentTimestamp();

  return {
    servers: [
      createSeedServer(seedIds.echoServer, "echo", "Echo MCP Server", "First-party echo MCP server.", "streamable_http", "low", now),
      createSeedServer(seedIds.internalDocsServer, "internal-docs", "Internal Docs MCP Server", "First-party internal docs MCP server.", "streamable_http", "medium", now),
      createSeedServer(seedIds.k8sReadonlyServer, "k8s-readonly", "Kubernetes Readonly MCP Server", "Read-only Kubernetes MCP server with local mock mode.", "streamable_http", "medium", now),
      createSeedServer(seedIds.stdioSampleServer, "stdio-sample", "stdio Sample MCP Server", "First-party stdio MCP server exposed through the stdio adapter runtime.", "stdio_adapter", "low", now)
    ],
    tools: [
      createSeedTool(seedIds.echoServer, "echo_message", "Return the provided message unchanged.", "low", now),
      createSeedTool(seedIds.echoServer, "get_server_time", "Return the current server time as an ISO-8601 timestamp.", "low", now),
      createSeedTool(seedIds.internalDocsServer, "search_docs", "Search synthetic internal documentation by keyword.", "low", now),
      createSeedTool(seedIds.internalDocsServer, "read_doc", "Read one synthetic internal document by id.", "low", now),
      createSeedTool(seedIds.k8sReadonlyServer, "list_namespaces", "List namespace names from the local read-only mock Kubernetes dataset.", "medium", now),
      createSeedTool(seedIds.k8sReadonlyServer, "list_pods", "List pods in one namespace from the local read-only mock Kubernetes dataset.", "medium", now),
      createSeedTool(seedIds.k8sReadonlyServer, "get_pod", "Read one pod by namespace and name from the local read-only mock Kubernetes dataset.", "medium", now),
      createSeedTool(seedIds.stdioSampleServer, "stdio_echo", "Return the provided message and metadata from the stdio sample server.", "low", now),
      createSeedTool(seedIds.stdioSampleServer, "get_stdio_status", "Return process and uptime status for the stdio sample server.", "low", now)
    ],
    grants: [
      {
        id: seedIds.sampleGrant,
        subjectType: "team",
        subjectId: seedIds.platformTeam,
        projectId: seedIds.sampleProject,
        serverId: seedIds.echoServer,
        allowedTools: ["echo_message", "get_server_time"],
        environment: "dev",
        approvedBy: seedIds.adminUser,
        reason: "Initial sample grant for local development.",
        enabled: true,
        createdAt: now
      },
      {
        id: seedIds.stdioSampleGrant,
        subjectType: "team",
        subjectId: seedIds.platformTeam,
        projectId: seedIds.sampleProject,
        serverId: seedIds.stdioSampleServer,
        allowedTools: ["stdio_echo", "get_stdio_status"],
        environment: "dev",
        approvedBy: seedIds.adminUser,
        reason: "Initial stdio adapter sample grant for local development.",
        enabled: true,
        createdAt: now
      }
    ],
    approvals: [],
    auditEvents: [
      {
        id: randomUUID(),
        timestamp: now,
        userId: seedIds.adminUser,
        teamId: seedIds.platformTeam,
        projectId: seedIds.sampleProject,
        clientId: "local-dev-client",
        serverId: seedIds.echoServer,
        toolName: "echo_message",
        eventType: "seed.audit_event",
        riskLevel: "low",
        policyDecision: "allow",
        traceId: "seed-trace",
        metadataJson: { source: "seed" }
      }
    ],
    toolCallEvents: [
      {
        id: randomUUID(),
        auditEventId: "seed-audit-event",
        serverId: seedIds.echoServer,
        toolName: "echo_message",
        status: "ok",
        latencyMs: 12,
        createdAt: now
      }
    ],
    serverHealth: [
      {
        id: randomUUID(),
        serverId: seedIds.echoServer,
        status: "healthy",
        latencyMs: 10,
        checkedAt: now
      }
    ]
  };
}

function createSeedServer(
  id: string,
  slug: string,
  displayName: string,
  description: string,
  transport: ApiMcpServer["transport"],
  riskLevel: ApiMcpServer["riskLevel"],
  timestamp: string
): ApiMcpServer {
  return {
    id,
    slug,
    displayName,
    description,
    ownerTeamId: seedIds.platformTeam,
    environment: "dev",
    transport,
    upstreamUrl: upstreamUrlForSlug(slug),
    enabled: true,
    riskLevel,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function upstreamUrlForSlug(slug: string) {
  if (slug === "echo") {
    return "http://localhost:5100/mcp";
  }
  if (slug === "internal-docs") {
    return "http://localhost:5101/mcp";
  }
  if (slug === "k8s-readonly") {
    return "http://localhost:5102/mcp";
  }
  if (slug === "stdio-sample") {
    return "http://localhost:5103/mcp";
  }

  return undefined;
}

function createSeedTool(
  serverId: string,
  name: string,
  description: string,
  riskLevel: ApiMcpTool["riskLevel"],
  timestamp: string
): ApiMcpTool {
  return {
    id: randomUUID(),
    serverId,
    name,
    description,
    enabled: true,
    riskLevel,
    discoveredAt: timestamp,
    lastSeenAt: timestamp
  };
}

function findServer(state: StoreState, serverId: string) {
  const server = state.servers.find((candidate) => candidate.id === serverId);
  if (!server) {
    throw notFound("MCP_SERVER_NOT_FOUND", "MCP server not found");
  }
  return server;
}

function findTool(state: StoreState, toolId: string) {
  const tool = state.tools.find((candidate) => candidate.id === toolId);
  if (!tool) {
    throw notFound("MCP_TOOL_NOT_FOUND", "MCP tool not found");
  }
  return tool;
}

function findGrant(state: StoreState, grantId: string) {
  const grant = state.grants.find((candidate) => candidate.id === grantId);
  if (!grant) {
    throw notFound("MCP_GRANT_NOT_FOUND", "MCP grant not found");
  }
  return grant;
}

function findApproval(state: StoreState, approvalId: string) {
  const approval = state.approvals.find((candidate) => candidate.id === approvalId);
  if (!approval) {
    throw notFound("APPROVAL_NOT_FOUND", "Approval request not found");
  }
  return approval;
}

function createGrantFromApproval(
  approval: ApiApproval,
  input: Record<string, unknown>,
  reviewerId: string,
  timestamp: string
): ApiGrant {
  const allowedTools = readApprovalGrantTools(input.allowedTools, approval.requestedTools);

  return {
    id: randomUUID(),
    subjectType: approval.subjectType,
    subjectId: approval.subjectId,
    projectId: approval.projectId,
    serverId: approval.serverId,
    allowedTools,
    environment: readEnvironment(input.environment) ?? approval.environment,
    expiresAt: optionalDateTime(input.expiresAt, "expiresAt") ?? approval.requestedExpiresAt,
    approvedBy: reviewerId,
    reason: optionalString(input.reason) ?? approval.reason,
    ticketUrl: optionalUrl(input.ticketUrl, "ticketUrl") ?? approval.ticketUrl,
    enabled: true,
    createdAt: timestamp
  };
}

function recordAudit(
  state: StoreState,
  auth: AuthContext,
  eventType: string,
  serverId: string | undefined,
  toolName: string | undefined,
  policyDecision: ApiAuditEvent["policyDecision"]
) {
  state.auditEvents.unshift({
    id: randomUUID(),
    timestamp: currentTimestamp(),
    userId: auth.userId,
    teamId: auth.teamIds[0],
    clientId: auth.clientId,
    serverId,
    toolName,
    eventType,
    riskLevel: "low",
    policyDecision,
    traceId: randomUUID(),
    metadataJson: { issuer: auth.issuer }
  });
}

function paginate<Item extends { id: string }>(items: Item[], limit: number, cursor?: string): ListResponse<Item> {
  const startIndex = cursor ? items.findIndex((item) => item.id === cursor) + 1 : 0;
  const safeStartIndex = startIndex < 0 ? 0 : startIndex;
  const pageItems = items.slice(safeStartIndex, safeStartIndex + limit);
  const nextItem = items[safeStartIndex + limit];

  return {
    items: pageItems,
    pageInfo: {
      limit,
      nextCursor: nextItem?.id
    }
  };
}

function recordBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {};
  }

  return body as Record<string, unknown>;
}

function requiredString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw validationError(`${fieldName} is required`);
  }

  return value;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readRequestedTools(input: Record<string, unknown>) {
  const requestedTools = readStringArray(input.requestedTools);
  if (requestedTools.length > 0) {
    requireExplicitApprovalTools(requestedTools, "requestedTools");
    return requestedTools;
  }
  const allowedTools = readStringArray(input.allowedTools);
  if (allowedTools.length > 0) {
    requireExplicitApprovalTools(allowedTools, "allowedTools");
    return allowedTools;
  }
  const toolName = optionalString(input.toolName);
  if (toolName) {
    requireExplicitApprovalTools([toolName], "toolName");
    return [toolName];
  }

  throw validationError("Approval requests must include at least one explicit requested tool.");
}

function readStringArray(value: unknown, fallback: string[] = []) {
  if (value === undefined) {
    return fallback;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw validationError("Expected an array of non-empty strings");
  }

  return value;
}

function readApprovalGrantTools(value: unknown, fallback: string[]) {
  const allowedTools = readStringArray(value, fallback);
  requireExplicitApprovalTools(allowedTools, "allowedTools");
  return allowedTools;
}

function requireExplicitApprovalTools(tools: string[], fieldName: string) {
  if (tools.length === 0) {
    throw validationError(`${fieldName} must include at least one tool`);
  }
  if (tools.includes("*")) {
    throw validationError(`${fieldName} must list explicit tools for approval-created grants`);
  }
}

function optionalUrl(value: unknown, fieldName: string) {
  const url = optionalString(value);
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw validationError(`${fieldName} must use http or https`);
    }
  } catch (caught: unknown) {
    if (caught instanceof TypeError) {
      throw validationError(`${fieldName} must be a valid URL`);
    }
    throw caught;
  }

  return url;
}

function optionalDateTime(value: unknown, fieldName: string) {
  const timestamp = optionalString(value);
  if (!timestamp) {
    return undefined;
  }

  if (Number.isNaN(Date.parse(timestamp))) {
    throw validationError(`${fieldName} must be a valid date-time`);
  }

  return timestamp;
}

function readSubjectType(value: unknown): GrantSubjectType | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "user" || value === "team" || value === "service_account") {
    return value;
  }

  throw validationError("subjectType must be user, team, or service_account");
}

function readEnvironment(value: unknown): ApiGrant["environment"] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "dev" || value === "stg" || value === "prod" || value === "shared") {
    return value;
  }

  throw validationError("environment must be dev, stg, prod, or shared");
}

function readBoolean(value: unknown) {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw validationError("Expected a boolean value");
  }

  return value;
}

function hasEmergencyScope(input: Record<string, unknown>) {
  return (
    input.global !== undefined ||
    input.highCritical !== undefined ||
    input.serverIds !== undefined ||
    input.serverSlugs !== undefined ||
    input.toolNames !== undefined ||
    input.subjectIds !== undefined ||
    input.clientIds !== undefined
  );
}

function isRiskLevel(value: unknown): value is ApiMcpTool["riskLevel"] {
  return value === "low" || value === "medium" || value === "high" || value === "critical";
}

function currentTimestamp() {
  return new Date().toISOString();
}
