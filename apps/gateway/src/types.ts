import type { McpToolDescriptor } from "@mcp-hub/mcp-protocol";
import type { PolicyEffect } from "@mcp-hub/policy";

export type GatewayPrincipal = {
  userId: string;
  teamIds: string[];
  clientId: string;
  issuer: string;
  audience: string;
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
};

export type GatewayTool = McpToolDescriptor & {
  enabled: boolean;
  riskLevel: "low" | "medium" | "high" | "critical";
};

export type GatewayGrant = {
  subjectType: "user" | "team" | "service_account";
  subjectId: string;
  projectId?: string;
  allowedTools: string[];
};

export type GatewayAuditEvent = {
  traceId: string;
  sessionId: string;
  userId: string;
  clientId: string;
  serverId: string;
  method: string;
  toolName?: string;
  policyDecision: PolicyEffect;
  latencyMs: number;
  upstreamStatus?: number;
  errorCode?: string;
  argumentHash?: string;
  argumentRedactedJson?: Record<string, unknown>;
  createdAt: string;
};

export type GatewayMetrics = {
  requestCount: number;
  deniedCount: number;
  upstreamFailureCount: number;
};
