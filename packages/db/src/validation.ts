import { z } from "zod";

export const EnvironmentSchema = z.enum(["dev", "stg", "prod", "shared"]);

export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const ServerTransportSchema = z.enum([
  "streamable_http",
  "sse_legacy",
  "stdio_adapter",
  "external"
]);

export const PolicyEffectSchema = z.enum(["allow", "deny", "needs_approval"]);

export const McpToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  riskLevel: RiskLevelSchema.default("low"),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()).optional()
});

export const McpServerManifestSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  displayName: z.string().min(1),
  description: z.string().optional(),
  ownerTeamId: z.string().uuid(),
  environment: EnvironmentSchema,
  transport: ServerTransportSchema,
  upstreamUrl: z.string().url().optional(),
  enabled: z.boolean().default(true),
  riskLevel: RiskLevelSchema.default("low"),
  tools: z.array(McpToolSchema).default([])
});

export const McpGrantSchema = z.object({
  subjectType: z.enum(["user", "team", "service_account"]),
  subjectId: z.string().min(1),
  projectId: z.string().uuid(),
  serverId: z.string().uuid(),
  allowedTools: z.array(z.string().min(1)),
  environment: EnvironmentSchema,
  expiresAt: z.string().datetime().optional(),
  approvedBy: z.string().uuid().optional(),
  reason: z.string().min(1),
  ticketUrl: z.string().url().optional(),
  enabled: z.boolean().default(true)
});

export const PolicyDecisionInputSchema = z.object({
  principal: z.object({
    subject: z.string().min(1),
    teams: z.array(z.string().min(1)).default([])
  }),
  projectId: z.string().uuid(),
  serverId: z.string().uuid(),
  toolName: z.string().min(1),
  environment: EnvironmentSchema,
  argumentHash: z.string().optional()
});

export const PolicyDecisionResultSchema = z.object({
  effect: PolicyEffectSchema,
  reason: z.string().min(1),
  matchedPolicyVersion: z.string().optional()
});

export const AuditEventSchema = z.object({
  timestamp: z.string().datetime(),
  userId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  sessionId: z.string().uuid().nullable().optional(),
  serverId: z.string().uuid().nullable().optional(),
  toolName: z.string().nullable().optional(),
  eventType: z.string().min(1),
  riskLevel: RiskLevelSchema,
  policyDecision: PolicyEffectSchema,
  argumentHash: z.string().nullable().optional(),
  argumentRedactedJson: z.record(z.unknown()).nullable().optional(),
  upstreamStatus: z.number().int().nullable().optional(),
  latencyMs: z.number().int().nonnegative().nullable().optional(),
  traceId: z.string().min(1),
  metadataJson: z.record(z.unknown()).default({})
});

export const HealthCheckResultSchema = z.object({
  serverId: z.string().uuid(),
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  latencyMs: z.number().int().nonnegative().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  checkedAt: z.string().datetime(),
  metadataJson: z.record(z.unknown()).default({})
});

export type McpServerManifestInput = z.infer<typeof McpServerManifestSchema>;
export type McpToolInput = z.infer<typeof McpToolSchema>;
export type McpGrantInput = z.infer<typeof McpGrantSchema>;
export type PolicyDecisionInput = z.infer<typeof PolicyDecisionInputSchema>;
export type PolicyDecisionResult = z.infer<typeof PolicyDecisionResultSchema>;
export type AuditEventInput = z.infer<typeof AuditEventSchema>;
export type HealthCheckResultInput = z.infer<typeof HealthCheckResultSchema>;
