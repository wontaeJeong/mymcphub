import {
  GeneratedApiClientError,
  formatGeneratedApiError,
  generatedApiRequest,
  getGeneratedApiBaseUrl
} from "./generated/mcp-hub-client";

export type Environment = "dev" | "stg" | "prod" | "shared";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ServerTransport = "streamable_http" | "sse_legacy" | "stdio_adapter" | "external";
export type ServerVersionStatus = "draft" | "pending" | "active" | "deprecated" | "rolled_back";
export type PolicyEffect = "allow" | "deny" | "needs_approval";
export type GrantSubjectType = "user" | "team" | "service_account";

export type AuthContext = {
  userId: string;
  principalType: GrantSubjectType;
  email: string;
  displayName: string;
  teamIds: string[];
  teams: string[];
  groups: string[];
  roles: string[];
  clientId: string;
  issuer: string;
  audience: string;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  authSource: "mock" | "oidc" | "service_account";
  tokenIssuer: string;
};

export type ApiMcpServer = {
  id: string;
  slug: string;
  displayName: string;
  description?: string;
  ownerTeamId: string;
  environment: Environment;
  transport: ServerTransport;
  upstreamUrl?: string;
  enabled: boolean;
  published?: boolean;
  quarantined?: boolean;
  riskLevel: RiskLevel;
  schemaVersion?: string;
  createdAt: string;
  updatedAt: string;
};


export type CreateServerToolInput = {
  name: string;
  description?: string;
  enabled: boolean;
  riskLevel: RiskLevel;
  inputSchema: Record<string, unknown>;
};

export type CreateServerInput = {
  slug: string;
  displayName: string;
  description?: string;
  ownerTeamId: string;
  environment: Environment;
  transport: ServerTransport;
  upstreamUrl?: string;
  enabled: boolean;
  riskLevel: RiskLevel;
  tools: CreateServerToolInput[];
};

export type ApiMcpTool = {
  id: string;
  serverId: string;
  name: string;
  description?: string;
  enabled: boolean;
  riskLevel: RiskLevel;
  inputSchema?: unknown;
  inputSchemaJson?: unknown;
  schemaVersion?: string;
  discoveredAt: string;
  lastSeenAt?: string;
};

export type ApiMcpServerVersion = {
  id: string;
  serverId: string;
  version: string;
  imageRef?: string;
  imageRepository?: string;
  imageTag?: string;
  imageDigest?: string;
  configHash?: string;
  toolSchemaHash?: string;
  status: ServerVersionStatus;
  rolloutStatus?: string;
  rolloutMessage?: string;
  createdBy?: string;
  gitOpsRepo?: string;
  gitOpsPath?: string;
  gitOpsRevision?: string;
  createdAt: string;
  updatedAt?: string;
  activatedAt?: string;
  rolledBackAt?: string;
  manifestJson?: Record<string, unknown>;
};

export type ApiGrant = {
  id: string;
  subjectType: GrantSubjectType;
  subjectId: string;
  projectId: string;
  serverId: string;
  allowedTools: string[];
  environment: Environment;
  expiresAt?: string;
  approvedBy?: string;
  reason: string;
  ticketUrl?: string;
  enabled: boolean;
  createdAt: string;
};

export type ApiApproval = {
  id: string;
  requesterId: string;
  subjectType: GrantSubjectType;
  subjectId: string;
  projectId: string;
  serverId: string;
  requestedTools: string[];
  environment: Environment;
  toolName?: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "expired";
  requestedAction: string;
  reason: string;
  ticketUrl?: string;
  requestedExpiresAt?: string;
  reviewerId?: string;
  reviewComment?: string;
  decidedBy?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiAuditEvent = {
  id: string;
  timestamp: string;
  userId?: string;
  teamId?: string;
  projectId?: string;
  clientId?: string;
  sessionId?: string;
  serverId?: string;
  toolName?: string;
  eventType: string;
  riskLevel: RiskLevel;
  policyDecision: PolicyEffect;
  traceId: string;
  metadataJson: Record<string, unknown>;
  argumentHash?: string;
  argumentRedactedJson?: unknown;
  latencyMs?: number;
  upstreamStatus?: number;
  errorCode?: string;
};

export type ListAuditEventsOptions = Readonly<{
  limit?: number;
  cursor?: string;
  from?: string;
  to?: string;
  user?: string;
  team?: string;
  project?: string;
  server?: string;
  tool?: string;
  event_type?: string;
  policy_decision?: string;
  risk_level?: string;
  trace_id?: string;
}>;

export type ApiToolCallEvent = {
  id: string;
  auditEventId: string;
  serverId: string;
  toolName: string;
  status: string;
  latencyMs?: number;
  createdAt: string;
};

export type ApiServerHealth = {
  id: string;
  serverId: string;
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs?: number;
  errorMessage?: string;
  checkedAt: string;
};

export type PageInfo = {
  limit: number;
  nextCursor?: string;
};

export type ListResponse<Item> = {
  items: Item[];
  pageInfo?: PageInfo;
};

export type ClientConfigKind = "generic" | "opencode" | "claude-code" | "codex" | "vscode";

export type ClientConfigResult = {
  client: ClientConfigKind;
  placeholder: boolean;
  gatewayUrl?: string;
  config: Record<string, unknown>;
};

export type EmergencyDenyResult = {
  enabled: boolean;
  reason: string;
  global: boolean;
  highCritical: boolean;
  serverIds: string[];
  serverSlugs: string[];
  toolNames: string[];
  subjectIds: string[];
  clientIds: string[];
  createdAt: string;
};

export type RevokeServerGrantsResult = {
  revoked: number;
  serverId: string;
};

export const ApiClientError = GeneratedApiClientError;
export type ApiClientError = GeneratedApiClientError;

export function getApiBaseUrl() {
  return getGeneratedApiBaseUrl();
}

export function formatApiError(error: unknown) {
  return formatGeneratedApiError(error);
}

export async function apiRequest<Result>(path: string, init: RequestInit = {}): Promise<Result> {
  return generatedApiRequest<Result>(path, init);
}

export async function getMe() {
  return apiRequest<{ auth: AuthContext }>("/api/me");
}

export async function listServers() {
  return apiRequest<ListResponse<ApiMcpServer>>("/api/servers");
}

export async function getServer(serverId: string) {
  return apiRequest<ApiMcpServer>(`/api/servers/${encodeURIComponent(serverId)}`);
}

export async function createServer(input: CreateServerInput) {
  return apiRequest<ApiMcpServer>("/api/servers", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function enableServer(serverId: string) {
  return apiRequest<ApiMcpServer>(`/api/servers/${encodeURIComponent(serverId)}/enable`, { method: "POST" });
}

export async function disableServer(serverId: string) {
  return apiRequest<ApiMcpServer>(`/api/servers/${encodeURIComponent(serverId)}/disable`, { method: "POST" });
}

export async function listTools(serverId: string) {
  return apiRequest<ListResponse<ApiMcpTool>>(`/api/servers/${encodeURIComponent(serverId)}/tools`);
}

export async function listServerVersions(serverId: string) {
  return apiRequest<ListResponse<ApiMcpServerVersion>>(`/api/servers/${encodeURIComponent(serverId)}/versions`);
}

export async function enableTool(serverId: string, toolId: string) {
  return apiRequest<ApiMcpTool>(`/api/servers/${encodeURIComponent(serverId)}/tools/${encodeURIComponent(toolId)}/enable`, { method: "POST" });
}

export async function disableTool(serverId: string, toolId: string) {
  return apiRequest<ApiMcpTool>(`/api/servers/${encodeURIComponent(serverId)}/tools/${encodeURIComponent(toolId)}/disable`, { method: "POST" });
}

export async function listGrants() {
  return apiRequest<ListResponse<ApiGrant>>("/api/grants");
}

export async function revokeGrant(grantId: string) {
  return apiRequest<ApiGrant>(`/api/grants/${encodeURIComponent(grantId)}/revoke`, { method: "POST" });
}

export async function listApprovals() {
  return apiRequest<ListResponse<ApiApproval>>("/api/approvals");
}

export function buildAuditEventsPath(options: ListAuditEventsOptions = {}) {
  const params = new URLSearchParams();
  appendSearchParam(params, "limit", options.limit);
  appendSearchParam(params, "cursor", options.cursor);
  appendSearchParam(params, "from", options.from);
  appendSearchParam(params, "to", options.to);
  appendSearchParam(params, "user", options.user);
  appendSearchParam(params, "team", options.team);
  appendSearchParam(params, "project", options.project);
  appendSearchParam(params, "server", options.server);
  appendSearchParam(params, "tool", options.tool);
  appendSearchParam(params, "event_type", options.event_type);
  appendSearchParam(params, "policy_decision", options.policy_decision);
  appendSearchParam(params, "risk_level", options.risk_level);
  appendSearchParam(params, "trace_id", options.trace_id);

  const query = params.toString();
  return query ? `/api/audit-events?${query}` : "/api/audit-events";
}

export async function listAuditEvents(options: ListAuditEventsOptions = {}) {
  return apiRequest<ListResponse<ApiAuditEvent>>(buildAuditEventsPath(options));
}

function appendSearchParam(params: URLSearchParams, key: string, value: number | string | undefined) {
  if (value === undefined || value === "") {
    return;
  }

  params.set(key, String(value));
}

export async function listToolCallEvents() {
  return apiRequest<ListResponse<ApiToolCallEvent>>("/api/tool-call-events");
}

export async function listServerHealth() {
  return apiRequest<ListResponse<ApiServerHealth>>("/api/server-health");
}

export type ApproveApprovalInput = {
  allowedTools?: string[];
  expiresAt?: string;
  reason?: string;
  ticketUrl?: string;
  reviewComment?: string;
};

export async function approveApproval(approvalId: string, input: ApproveApprovalInput = {}) {
  return apiRequest<ApiApproval>(`/api/approvals/${encodeURIComponent(approvalId)}/approve`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export type RejectApprovalInput = {
  reviewComment?: string;
};

export async function rejectApproval(approvalId: string, input: RejectApprovalInput = {}) {
  return apiRequest<ApiApproval>(`/api/approvals/${encodeURIComponent(approvalId)}/reject`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export type CreateApprovalInput = {
  subjectType: GrantSubjectType;
  subjectId: string;
  projectId: string;
  serverId: string;
  requestedTools: string[];
  environment: Environment;
  reason: string;
  ticketUrl?: string;
  requestedExpiresAt?: string;
  requestedAction: string;
};

export async function createApproval(input: CreateApprovalInput) {
  return apiRequest<ApiApproval>("/api/approvals", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export type CreateGrantInput = {
  subjectType: GrantSubjectType;
  subjectId: string;
  projectId: string;
  serverId: string;
  allowedTools: string[];
  environment: Environment;
  expiresAt?: string;
  reason: string;
  ticketUrl?: string;
  enabled: boolean;
};

export async function createGrant(input: CreateGrantInput) {
  return apiRequest<ApiGrant>("/api/grants", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function generateClientConfig(serverId: string, client: ClientConfigKind) {
  return apiRequest<ClientConfigResult>("/api/client-config/generate", {
    method: "POST",
    body: JSON.stringify({ serverId, client })
  });
}

export async function enableEmergencyDeny(reason: string) {
  return apiRequest<EmergencyDenyResult>("/api/admin/emergency-deny", {
    method: "POST",
    body: JSON.stringify({ reason })
  });
}

export async function revokeServerGrants(serverId: string) {
  return apiRequest<RevokeServerGrantsResult>(`/api/admin/revoke-server-grants/${encodeURIComponent(serverId)}`, {
    method: "POST"
  });
}
