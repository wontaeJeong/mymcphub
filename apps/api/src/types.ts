import type { Environment, PolicyEffect, RiskLevel, ServerTransport } from "@mcp-hub/db";

import type { AuditJsonValue } from "./audit";

export type AuthContext = {
  userId: string;
  principalType: "user" | "team" | "service_account";
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

export type GrantSubjectType = "user" | "team" | "service_account";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled" | "expired";

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
  status: ApprovalStatus;
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

export type ApiEmergencyPolicyState = {
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
  argumentHash?: string;
  argumentRedactedJson?: AuditJsonValue;
  latencyMs?: number;
  upstreamStatus?: number;
  errorCode?: string;
  metadataJson: Record<string, unknown>;
};

export type AuditContext = {
  auth: AuthContext;
  traceId: string;
};

export type AuditEventSearchFilters = {
  from?: string;
  to?: string;
  user?: string;
  team?: string;
  project?: string;
  server?: string;
  tool?: string;
  eventType?: string;
  policyDecision?: PolicyEffect;
  riskLevel?: RiskLevel;
  traceId?: string;
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
