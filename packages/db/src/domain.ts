export type Environment = "dev" | "stg" | "prod" | "shared";

export type ServerTransport = "streamable_http" | "sse_legacy" | "stdio_adapter" | "external";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type GrantSubjectType = "user" | "team" | "service_account";

export type PolicyEffect = "allow" | "deny" | "needs_approval";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export type User = {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
};

export type Team = {
  id: string;
  slug: string;
  displayName: string;
  createdAt: Date;
};

export type TeamMembership = {
  teamId: string;
  userId: string;
  role: string;
  createdAt: Date;
};

export type Project = {
  id: string;
  slug: string;
  displayName: string;
  ownerTeamId: string;
  createdAt: Date;
};

export type ProjectMembership = {
  projectId: string;
  subjectType: GrantSubjectType;
  subjectId: string;
  role: string;
  createdAt: Date;
};

export type McpServer = {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  ownerTeamId: string;
  environment: Environment;
  transport: ServerTransport;
  upstreamUrl: string | null;
  enabled: boolean;
  riskLevel: RiskLevel;
  createdAt: Date;
  updatedAt: Date;
};

export type McpServerVersion = {
  id: string;
  serverId: string;
  version: string;
  imageRef: string | null;
  manifestJson: Record<string, unknown>;
  createdAt: Date;
};

export type McpTool = {
  id: string;
  serverId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  riskLevel: RiskLevel;
  discoveredAt: Date;
  lastSeenAt: Date | null;
};

export type McpToolSchemaRecord = {
  id: string;
  toolId: string;
  schemaHash: string;
  inputSchemaJson: Record<string, unknown>;
  outputSchemaJson: Record<string, unknown> | null;
  descriptionSnapshot: string | null;
  version: number;
  createdAt: Date;
};

export type McpGrant = {
  id: string;
  subjectType: GrantSubjectType;
  subjectId: string;
  projectId: string;
  serverId: string;
  allowedToolsJson: string[];
  environment: Environment;
  expiresAt: Date | null;
  approvedBy: string | null;
  reason: string;
  ticketUrl: string | null;
  enabled: boolean;
  createdAt: Date;
};

export type ApprovalRequest = {
  id: string;
  requesterId: string;
  projectId: string;
  serverId: string;
  toolName: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requestedAction: string;
  reason: string;
  decidedBy: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  metadataJson: Record<string, unknown>;
};

export type OAuthClient = {
  id: string;
  clientId: string;
  displayName: string;
  ownerTeamId: string;
  redirectUrisJson: string[];
  createdAt: Date;
};

export type McpSession = {
  id: string;
  userId: string | null;
  teamId: string | null;
  projectId: string | null;
  clientId: string | null;
  gatewaySessionId: string;
  startedAt: Date;
  endedAt: Date | null;
  metadataJson: Record<string, unknown>;
};

export type AuditEvent = {
  id: string;
  timestamp: Date;
  userId: string | null;
  teamId: string | null;
  projectId: string | null;
  clientId: string | null;
  sessionId: string | null;
  serverId: string | null;
  toolName: string | null;
  eventType: string;
  riskLevel: RiskLevel;
  policyDecision: PolicyEffect;
  argumentHash: string | null;
  argumentRedactedJson: Record<string, unknown> | null;
  upstreamStatus: number | null;
  latencyMs: number | null;
  traceId: string;
  metadataJson: Record<string, unknown>;
};

export type ToolCallEvent = {
  id: string;
  auditEventId: string;
  serverId: string;
  toolName: string;
  status: string;
  latencyMs: number | null;
  inputSchemaHash: string | null;
  argumentHash: string | null;
  createdAt: Date;
};

export type ServerHealthCheck = {
  id: string;
  serverId: string;
  status: HealthStatus;
  latencyMs: number | null;
  errorMessage: string | null;
  checkedAt: Date;
  metadataJson: Record<string, unknown>;
};

export type SecretRef = {
  id: string;
  scopeType: "server" | "project" | "team";
  scopeId: string;
  provider: string;
  refKey: string;
  description: string | null;
  createdAt: Date;
};

export type PolicyVersion = {
  id: string;
  version: string;
  policyJson: Record<string, unknown>;
  createdBy: string | null;
  active: boolean;
  createdAt: Date;
};
