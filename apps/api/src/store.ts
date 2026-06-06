import { randomUUID } from "node:crypto";

import { McpGrantSchema, McpServerManifestSchema, seedIds } from "@mcp-hub/db";

import { createAuditArgumentSnapshot } from "./audit";
import { notFound, validationError } from "./errors";
import type {
  ApiApproval,
  ApiAuditEvent,
  ApiEmergencyPolicyState,
  AuditContext,
  AuditEventSearchFilters,
  ApiGrant,
  ApiMcpServer,
  ApiMcpTool,
  ApiServerHealth,
  ApiToolCallEvent,
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
    createServer: (body: unknown, context: AuditContext) => {
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
      recordAudit(state, context, "mcp_server.created", server.id, undefined, "allow", undefined, body);
      return server;
    },
    getServer: (serverId: string) => findServer(state, serverId),
    patchServer: (serverId: string, body: unknown, context: AuditContext) => {
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
      recordAudit(state, context, "mcp_server.updated", server.id, undefined, "allow", undefined, body);
      return server;
    },
    setServerEnabled: (serverId: string, enabled: boolean, context: AuditContext) => {
      const server = findServer(state, serverId);
      server.enabled = enabled;
      server.updatedAt = currentTimestamp();
      recordAudit(state, context, enabled ? "mcp_server.enabled" : "server.disabled", server.id, undefined, "allow");
      return server;
    },
    listTools: (serverId: string) => {
      findServer(state, serverId);
      return { items: state.tools.filter((tool) => tool.serverId === serverId) };
    },
    patchTool: (serverId: string, toolId: string, body: unknown, context: AuditContext) => {
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
      recordAudit(state, context, "mcp_tool.updated", serverId, tool.name, "allow", undefined, body);
      return tool;
    },
    setToolEnabled: (serverId: string, toolId: string, enabled: boolean, context: AuditContext) => {
      const tool = findTool(state, toolId);
      tool.enabled = enabled;
      tool.lastSeenAt = currentTimestamp();
      recordAudit(state, context, enabled ? "mcp_tool.enabled" : "tool.disabled", serverId, tool.name, "allow");
      return tool;
    },
    listGrants: () => ({ items: state.grants }),
    createGrant: (body: unknown, context: AuditContext) => {
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
        approvedBy: input.approvedBy ?? context.auth.userId,
        reason: input.reason,
        ticketUrl: input.ticketUrl,
        enabled: input.enabled,
        createdAt: currentTimestamp()
      };
      state.grants.push(grant);
      recordAudit(state, context, "grant.created", grant.serverId, undefined, "allow", grant.projectId, body);
      return grant;
    },
    patchGrant: (grantId: string, body: unknown, context: AuditContext) => {
      const grant = findGrant(state, grantId);
      const patch = recordBody(body);

      if (typeof patch.enabled === "boolean") {
        grant.enabled = patch.enabled;
      }
      if (Array.isArray(patch.allowedTools) && patch.allowedTools.every((tool) => typeof tool === "string")) {
        grant.allowedTools = patch.allowedTools;
      }
      recordAudit(state, context, "mcp_grant.updated", grant.serverId, undefined, "allow", grant.projectId, body);
      return grant;
    },
    revokeGrant: (grantId: string, context: AuditContext) => {
      const grant = findGrant(state, grantId);
      grant.enabled = false;
      recordAudit(state, context, "grant.revoked", grant.serverId, undefined, "allow", grant.projectId);
      return grant;
    },
    listApprovals: () => ({ items: state.approvals }),
    createApproval: (body: unknown, context: AuditContext) => {
      const input = recordBody(body);
      const serverId = requiredString(input.serverId, "serverId");
      const server = findServer(state, serverId);
      const now = currentTimestamp();
      const requestedTools = readRequestedTools(input);
      const approval: ApiApproval = {
        id: randomUUID(),
        requesterId: context.auth.userId,
        subjectType: readSubjectType(input.subjectType) ?? "user",
        subjectId: optionalString(input.subjectId) ?? context.auth.userId,
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
      recordAudit(state, context, "approval.created", approval.serverId, approval.toolName, "needs_approval", approval.projectId, body);
      return approval;
    },
    decideApproval: (approvalId: string, decision: "approved" | "rejected", context: AuditContext, body: unknown = {}) => {
      const approval = findApproval(state, approvalId);
      if (approval.status !== "pending") {
        throw validationError("Approval has already been decided", { status: approval.status });
      }
      const input = recordBody(body);
      const now = currentTimestamp();
      const reviewerId = optionalString(input.reviewerId) ?? context.auth.userId;
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
      recordAudit(
        state,
        context,
        decision === "approved" ? "approval.approved" : "approval.rejected",
        approval.serverId,
        approval.toolName,
        decision === "approved" ? "allow" : "deny",
        approval.projectId,
        body
      );
      return approval;
    },
    listAuditEvents: (limit: number, cursor?: string, filters: AuditEventSearchFilters = {}): ListResponse<ApiAuditEvent> =>
      paginate(filterAuditEvents(state.auditEvents, filters), limit, cursor),
    ingestGatewayAuditEvent: (body: unknown, context: AuditContext) => {
      const input = recordBody(body);
      const serverId = optionalString(input.serverId);
      const toolName = optionalString(input.toolName);
      const riskLevel = readRiskLevel(input.riskLevel) ?? deriveAuditRisk(state, serverId, toolName);
      const argumentJson = readAuditJsonValue(input.argumentRedactedJson);
      const argumentSnapshot = argumentJson === undefined ? undefined : createAuditArgumentSnapshot(argumentJson);
      const event: ApiAuditEvent = {
        id: randomUUID(),
        timestamp: optionalDateTime(input.timestamp, "timestamp") ?? currentTimestamp(),
        userId: optionalString(input.userId),
        teamId: optionalString(input.teamId),
        projectId: optionalString(input.projectId),
        clientId: optionalString(input.clientId),
        sessionId: optionalString(input.sessionId),
        serverId,
        toolName,
        eventType: requiredString(input.eventType, "eventType"),
        riskLevel,
        policyDecision: readPolicyDecision(input.policyDecision),
        traceId: optionalString(input.traceId) ?? context.traceId,
        argumentHash: argumentSnapshot?.argumentHash ?? optionalString(input.argumentHash),
        argumentRedactedJson: argumentSnapshot?.argumentRedactedJson,
        latencyMs: optionalNumber(input.latencyMs, "latencyMs"),
        upstreamStatus: optionalNumber(input.upstreamStatus, "upstreamStatus"),
        errorCode: optionalString(input.errorCode),
        metadataJson: {
          source: "gateway",
          ingestedBy: context.auth.userId,
          upstreamStatus: optionalNumber(input.upstreamStatus, "upstreamStatus"),
          latencyMs: optionalNumber(input.latencyMs, "latencyMs"),
          errorCode: optionalString(input.errorCode)
        }
      };
      state.auditEvents.unshift(event);
      return event;
    },
    listToolCallEvents: () => ({ items: state.toolCallEvents }),
    listServerHealth: () => ({ items: state.serverHealth }),
    enableEmergencyDeny: (body: unknown, context: AuditContext) => {
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
      recordAudit(state, context, "emergency_policy.enabled", undefined, undefined, "deny", undefined, body);
      return state.emergencyDeny;
    },
    disableEmergencyDeny: (context: AuditContext) => {
      state.emergencyDeny = {
        enabled: false,
        reason: "Emergency deny disabled",
        global: false,
        highCritical: false,
        serverIds: [],
        serverSlugs: [],
        toolNames: [],
        subjectIds: [],
        clientIds: [],
        createdAt: currentTimestamp()
      };
      recordAudit(state, context, "emergency_policy.disabled", undefined, undefined, "allow");
      return state.emergencyDeny;
    },
    revokeServerGrants: (serverId: string, context: AuditContext) => {
      findServer(state, serverId);
      let revoked = 0;
      for (const grant of state.grants) {
        if (grant.serverId === serverId && grant.enabled) {
          grant.enabled = false;
          revoked += 1;
        }
      }
      recordAudit(state, context, "admin.server_grants.revoked", serverId, undefined, "deny");
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
  context: AuditContext,
  eventType: string,
  serverId: string | undefined,
  toolName: string | undefined,
  policyDecision: ApiAuditEvent["policyDecision"],
  projectId?: string,
  argumentSource?: unknown
) {
  const argumentSnapshot = argumentSource === undefined ? {} : createAuditArgumentSnapshot(argumentSource);

  state.auditEvents.unshift({
    id: randomUUID(),
    timestamp: currentTimestamp(),
    userId: context.auth.userId,
    teamId: context.auth.teamIds[0],
    projectId,
    clientId: context.auth.clientId,
    serverId,
    toolName,
    eventType,
    riskLevel: deriveAuditRisk(state, serverId, toolName),
    policyDecision,
    traceId: context.traceId,
    ...argumentSnapshot,
    metadataJson: { issuer: context.auth.issuer }
  });
}

function filterAuditEvents(events: ApiAuditEvent[], filters: AuditEventSearchFilters) {
  return events.filter((event) => {
    const eventTime = Date.parse(event.timestamp);
    if (filters.from && eventTime < Date.parse(filters.from)) {
      return false;
    }
    if (filters.to && eventTime > Date.parse(filters.to)) {
      return false;
    }
    if (filters.user && event.userId !== filters.user) {
      return false;
    }
    if (filters.team && event.teamId !== filters.team) {
      return false;
    }
    if (filters.project && event.projectId !== filters.project) {
      return false;
    }
    if (filters.server && event.serverId !== filters.server) {
      return false;
    }
    if (filters.tool && event.toolName !== filters.tool) {
      return false;
    }
    if (filters.eventType && event.eventType !== filters.eventType) {
      return false;
    }
    if (filters.policyDecision && event.policyDecision !== filters.policyDecision) {
      return false;
    }
    if (filters.riskLevel && event.riskLevel !== filters.riskLevel) {
      return false;
    }
    if (filters.traceId && event.traceId !== filters.traceId) {
      return false;
    }

    return true;
  });
}

function deriveAuditRisk(state: StoreState, serverId: string | undefined, toolName: string | undefined): ApiAuditEvent["riskLevel"] {
  if (serverId && toolName) {
    const tool = state.tools.find((candidate) => candidate.serverId === serverId && candidate.name === toolName);
    if (tool) {
      return tool.riskLevel;
    }
  }
  if (serverId) {
    const server = state.servers.find((candidate) => candidate.id === serverId);
    if (server) {
      return server.riskLevel;
    }
  }

  return "low";
}

function paginate<Item extends { id: string }>(items: Item[], limit: number, cursor?: string): ListResponse<Item> {
  const startIndex = cursor ? items.findIndex((item) => item.id === cursor) + 1 : 0;
  const safeStartIndex = startIndex < 0 ? 0 : startIndex;
  const pageItems = items.slice(safeStartIndex, safeStartIndex + limit);
  const nextItem = items[safeStartIndex + limit];
  const lastPageItem = pageItems[pageItems.length - 1];

  return {
    items: pageItems,
    pageInfo: {
      limit,
      nextCursor: nextItem ? lastPageItem?.id : undefined
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

function optionalNumber(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw validationError(`${fieldName} must be a finite number`);
  }

  return value;
}

function readPolicyDecision(value: unknown): ApiAuditEvent["policyDecision"] {
  if (value === "allow" || value === "deny" || value === "needs_approval") {
    return value;
  }

  throw validationError("policyDecision must be allow, deny, or needs_approval");
}

function readRiskLevel(value: unknown): ApiAuditEvent["riskLevel"] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (isRiskLevel(value)) {
    return value;
  }

  throw validationError("riskLevel must be low, medium, high, or critical");
}

function readAuditJsonValue(value: unknown): ApiAuditEvent["argumentRedactedJson"] {
  if (value === undefined) {
    return undefined;
  }
  if (isAuditJsonValue(value)) {
    return value;
  }

  throw validationError("argumentRedactedJson must be JSON-compatible");
}

function isAuditJsonValue(value: unknown): value is ApiAuditEvent["argumentRedactedJson"] {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every((item) => isAuditJsonValue(item));
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every((nestedValue) => isAuditJsonValue(nestedValue));
  }

  return false;
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
