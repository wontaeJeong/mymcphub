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

export const GrantSubjectTypeSchema = z.enum(["user", "team", "service_account"]);

export const ApprovalStatusSchema = z.enum(["pending", "approved", "rejected", "cancelled", "expired"]);

export const ServerVersionStatusSchema = z.enum(["draft", "pending", "active", "deprecated", "rolled_back"]);

const HttpUrlSchema = z.string().url().refine(isHttpUrl, "URL must use http or https");

const ExplicitToolListSchema = z.array(z.string().min(1))
  .min(1)
  .refine((tools) => !tools.includes("*"), "Tool list must not contain wildcard entries");

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

export const CreateMcpServerVersionSchema = z.object({
  serverId: z.string().uuid(),
  version: z.string().min(1),
  imageRef: z.string().min(1).nullable().optional(),
  imageRepository: z.string().min(1).nullable().optional(),
  imageTag: z.string().min(1).nullable().optional(),
  imageDigest: z.string().min(1).nullable().optional(),
  configHash: z.string().min(1).nullable().optional(),
  toolSchemaHash: z.string().min(1).nullable().optional(),
  status: ServerVersionStatusSchema.default("draft"),
  createdBy: z.string().uuid().nullable().optional(),
  activatedAt: z.string().datetime().nullable().optional(),
  manifestJson: z.record(z.unknown()).default({})
});

export const McpGrantSchema = z.object({
  subjectType: GrantSubjectTypeSchema,
  subjectId: z.string().min(1),
  projectId: z.string().uuid(),
  serverId: z.string().uuid(),
  allowedTools: z.array(z.string().min(1)),
  environment: EnvironmentSchema,
  expiresAt: z.string().datetime().optional(),
  approvedBy: z.string().uuid().optional(),
  reason: z.string().min(1),
  ticketUrl: HttpUrlSchema.optional(),
  enabled: z.boolean().default(true)
});

export const PolicyDecisionInputSchema = z.object({
  subject: z.object({
    type: GrantSubjectTypeSchema,
    userId: z.string().min(1).optional(),
    teamIds: z.array(z.string().min(1)).optional(),
    serviceAccountId: z.string().min(1).optional()
  }),
  client: z.object({
    clientId: z.string().min(1).optional(),
    clientType: z.string().min(1).optional()
  }),
  project: z.object({
    projectId: z.string().uuid().optional()
  }).optional(),
  server: z.object({
    serverId: z.string().uuid(),
    serverSlug: z.string().min(1),
    environment: EnvironmentSchema,
    enabled: z.boolean()
  }),
  tool: z.object({
    name: z.string().min(1),
    riskLevel: RiskLevelSchema,
    enabled: z.boolean()
  }).optional(),
  action: z.enum(["connect", "discover_tool", "call_tool", "read_resource", "get_prompt", "admin"]),
  requestTime: z.string().datetime()
});

export const PolicyDecisionResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().min(1),
  reasonCode: z.string().min(1),
  matchedGrantIds: z.array(z.string().min(1)).default([]),
  requiresApproval: z.boolean().optional(),
  requiresStepUp: z.boolean().optional(),
  matchedPolicyVersion: z.string().optional()
});

export const ApprovalRequestSchema = z.object({
  requesterId: z.string().min(1),
  subjectType: GrantSubjectTypeSchema,
  subjectId: z.string().min(1),
  projectId: z.string().uuid(),
  serverId: z.string().uuid(),
  requestedTools: ExplicitToolListSchema,
  environment: EnvironmentSchema,
  reason: z.string().min(1),
  ticketUrl: HttpUrlSchema.optional(),
  requestedExpiresAt: z.string().datetime().optional(),
  status: ApprovalStatusSchema.default("pending"),
  reviewerId: z.string().min(1).optional(),
  reviewComment: z.string().min(1).optional(),
  toolName: z.string().min(1).optional(),
  requestedAction: z.string().min(1).default("call_tool")
});

export const EmergencyPolicyStateSchema = z.object({
  enabled: z.boolean().default(true),
  reason: z.string().min(1),
  global: z.boolean().default(true),
  highCritical: z.boolean().default(false),
  serverIds: z.array(z.string().min(1)).default([]),
  serverSlugs: z.array(z.string().min(1)).default([]),
  toolNames: z.array(z.string().min(1)).default([]),
  subjectIds: z.array(z.string().min(1)).default([]),
  clientIds: z.array(z.string().min(1)).default([])
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
export type CreateMcpServerVersionInput = z.infer<typeof CreateMcpServerVersionSchema>;
export type McpGrantInput = z.infer<typeof McpGrantSchema>;
export type PolicyDecisionInput = z.infer<typeof PolicyDecisionInputSchema>;
export type PolicyDecisionResult = z.infer<typeof PolicyDecisionResultSchema>;
export type ApprovalRequestInput = z.infer<typeof ApprovalRequestSchema>;
export type EmergencyPolicyStateInput = z.infer<typeof EmergencyPolicyStateSchema>;
export type AuditEventInput = z.infer<typeof AuditEventSchema>;
export type HealthCheckResultInput = z.infer<typeof HealthCheckResultSchema>;

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (caught: unknown) {
    if (caught instanceof TypeError) {
      return false;
    }
    throw caught;
  }
}
