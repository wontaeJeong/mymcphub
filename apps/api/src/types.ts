import type { Environment, PolicyEffect, RiskLevel, ServerTransport } from "@mcp-hub/db";

export type AuthContext = {
  userId: string;
  email: string;
  displayName: string;
  teamIds: string[];
  roles: string[];
  clientId: string;
  issuer: string;
  audience: string;
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
  createdAt: string;
  updatedAt: string;
};

export type ApiMcpTool = {
  id: string;
  serverId: string;
  name: string;
  description?: string;
  enabled: boolean;
  riskLevel: RiskLevel;
  discoveredAt: string;
  lastSeenAt?: string;
};

export type ApiGrant = {
  id: string;
  subjectType: "user" | "team" | "service_account";
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
  projectId: string;
  serverId: string;
  toolName?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requestedAction: string;
  reason: string;
  decidedBy?: string;
  decidedAt?: string;
  createdAt: string;
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
