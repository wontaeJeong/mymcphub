export type Environment = "dev" | "stg" | "prod" | "shared";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ServerTransport = "streamable_http" | "sse_legacy" | "stdio_adapter" | "external";
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
};

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

export class ApiClientError extends Error {
  readonly status?: number;
  readonly details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.details = details;
  }
}

export function getApiBaseUrl() {
  return process.env.MCP_API_URL ?? process.env.NEXT_PUBLIC_MCP_API_URL ?? "http://localhost:4000";
}

export function formatApiError(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.status ? `${error.message} (${error.status})` : error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The Control Plane API is unavailable.";
}

export async function apiRequest<Result>(path: string, init: RequestInit = {}): Promise<Result> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(new URL(path, getApiBaseUrl()), {
      ...init,
      headers,
      cache: "no-store"
    });
  } catch (error) {
    throw new ApiClientError("Unable to reach the Control Plane API.", undefined, error);
  }

  if (!response.ok) {
    throw new ApiClientError(await readErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as Result;
  }

  return (await response.json()) as Result;
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

export async function listAuditEvents(limit = 50) {
  return apiRequest<ListResponse<ApiAuditEvent>>(`/api/audit-events?limit=${limit}`);
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

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as unknown;
    if (isErrorResponse(body)) {
      return body.error.message;
    }
  } catch {
    return response.statusText || "Control Plane API request failed.";
  }

  return response.statusText || "Control Plane API request failed.";
}

function isErrorResponse(value: unknown): value is { error: { message: string } } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const error = candidate.error;
  if (!error || typeof error !== "object") {
    return false;
  }

  const errorRecord = error as Record<string, unknown>;
  return typeof errorRecord.message === "string";
}
