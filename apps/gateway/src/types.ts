import type { McpToolDescriptor } from "@mcp-hub/mcp-protocol";
import type { PolicyEffect } from "@mcp-hub/policy";

export type GatewayAuditJsonValue = string | number | boolean | null | GatewayAuditJsonValue[] | { [key: string]: GatewayAuditJsonValue };

export type GatewayPrincipal = {
  userId: string;
  principalType: "user" | "team" | "service_account";
  teamIds: string[];
  clientId: string;
  issuer: string;
  audience: string;
  projectId: string;
  groups: string[];
  roles: string[];
  isPlatformAdmin: boolean;
};

export type GatewayServer = {
  id: string;
  slug: string;
  environment: "dev" | "stg" | "prod" | "shared";
  transport: "streamable_http" | "external" | "stdio_adapter";
  upstreamUrl?: string;
  enabled: boolean;
  tools: GatewayTool[];
  grants: GatewayGrant[];
  emergencyDeny?: GatewayEmergencyPolicy;
};

export type GatewayTool = McpToolDescriptor & {
  enabled: boolean;
  riskLevel: "low" | "medium" | "high" | "critical";
};

export type GatewayGrant = {
  id?: string;
  subjectType: "user" | "team" | "service_account";
  subjectId: string;
  projectId?: string;
  allowedTools: string[];
  environment?: GatewayServer["environment"];
  expiresAt?: string;
  approvedBy?: string;
  enabled?: boolean;
};

export type GatewayEmergencyPolicy = {
  enabled: boolean;
  reason?: string;
  global?: boolean;
  highCritical?: boolean;
  serverIds?: string[];
  serverSlugs?: string[];
  toolNames?: string[];
  subjectIds?: string[];
  clientIds?: string[];
};

export type GatewayAuditEventType =
  | "auth.success"
  | "auth.failure"
  | "server.connect.allowed"
  | "server.connect.denied"
  | "tool.discovery.allowed"
  | "tool.discovery.filtered"
  | "tool.call.allowed"
  | "tool.call.denied"
  | "tool.call.succeeded"
  | "tool.call.failed"
  | "server.disabled";

export type GatewayAuditEvent = {
  eventType: GatewayAuditEventType;
  traceId: string;
  sessionId?: string;
  userId?: string;
  clientId?: string;
  serverId?: string;
  method: string;
  toolName?: string;
  riskLevel: GatewayTool["riskLevel"];
  policyDecision: PolicyEffect;
  latencyMs: number;
  upstreamStatus?: number;
  errorCode?: string;
  argumentHash?: string;
  argumentRedactedJson?: GatewayAuditJsonValue;
  createdAt: string;
};

export type GatewayMetrics = {
  requestCount: number;
  deniedCount: number;
  upstreamFailureCount: number;
};
