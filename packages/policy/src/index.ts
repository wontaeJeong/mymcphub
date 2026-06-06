export type PolicyEffect = "allow" | "deny" | "needs_approval";

export type PolicyReasonCode =
  | "ALLOW"
  | "ADMIN_ALLOW"
  | "EMERGENCY_DENY"
  | "SERVER_DISABLED"
  | "TOOL_DISABLED"
  | "CONNECT_GRANT_REQUIRED"
  | "TOOL_GRANT_REQUIRED"
  | "EXPLICIT_TOOL_GRANT_REQUIRED"
  | "PROD_GRANT_REQUIRED"
  | "APPROVAL_REQUIRED"
  | "STEP_UP_REQUIRED"
  | "ADMIN_REQUIRES_PLATFORM_ADMIN"
  | "INVALID_SUBJECT"
  | "INVALID_ENVIRONMENT"
  | "INVALID_RISK_LEVEL"
  | "DENY_BY_DEFAULT";

export type PolicyDecision = {
  effect: PolicyEffect;
  allowed: boolean;
  reason: string;
  reasonCode: PolicyReasonCode;
  matchedGrantIds: string[];
  requiresApproval: boolean;
  requiresStepUp: boolean;
  discoverableToolNames?: string[];
};

export const denyByDefault: PolicyDecision = {
  effect: "deny",
  allowed: false,
  reason: "No policy rule matched.",
  reasonCode: "DENY_BY_DEFAULT",
  matchedGrantIds: [],
  requiresApproval: false,
  requiresStepUp: false
};

export type PolicyEnvironment = "dev" | "stg" | "prod" | "shared";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type GrantSubjectType = "user" | "team" | "service_account";

export type PromptPolicyAction = "connect" | "discover_tool" | "call_tool" | "read_resource" | "get_prompt" | "admin";

export type GatewayPolicyAction = "tools/list" | "tools/call";

export type PolicyAction = PromptPolicyAction | GatewayPolicyAction;

export type PolicyPrincipal = {
  subject: string;
  principalType: GrantSubjectType;
  teamIds: string[];
  teams?: string[];
  groups?: string[];
  roles?: string[];
  isAdmin?: boolean;
  isPlatformAdmin?: boolean;
};

export type PolicyServer = {
  id: string;
  slug: string;
  environment: PolicyEnvironment;
  enabled: boolean;
  riskLevel?: RiskLevel;
  tools?: PolicyTool[];
};

export type PolicyTool = {
  name: string;
  enabled: boolean;
  riskLevel: RiskLevel;
};

export type PolicyGrant = {
  id: string;
  subjectType: GrantSubjectType;
  subjectId: string;
  projectId?: string;
  serverId: string;
  allowedTools: string[];
  environment: PolicyEnvironment;
  expiresAt?: string | Date;
  approvedBy?: string;
  enabled: boolean;
};

export type PolicyEmergencyDeny = {
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

export type PolicyClient = {
  id: string;
  displayName?: string;
  ownerTeamId?: string;
};

export type PolicyDecisionInput = {
  subject: {
    type: GrantSubjectType;
    userId?: string;
    teamIds?: string[];
    serviceAccountId?: string;
  };
  client: {
    clientId?: string;
    clientType?: string;
  };
  project?: {
    projectId?: string;
  };
  server: {
    serverId: string;
    serverSlug: string;
    environment: PolicyEnvironment;
    enabled: boolean;
  };
  tool?: {
    name: string;
    riskLevel: RiskLevel;
    enabled: boolean;
  };
  action: PromptPolicyAction;
  requestTime: string;
};

export type PolicyDecisionResult = {
  allowed: boolean;
  reasonCode: string;
  reason: string;
  matchedGrantIds: string[];
  requiresApproval?: boolean;
  requiresStepUp?: boolean;
};

export type PolicyDecisionContext = {
  grants?: PolicyGrant[];
  serverTools?: PolicyTool[];
  emergencyDeny?: boolean | PolicyEmergencyDeny;
  stepUpSatisfied?: boolean;
  principal?: Pick<PolicyPrincipal, "groups" | "roles" | "isAdmin" | "isPlatformAdmin">;
};

export type PolicyInput = {
  principal: PolicyPrincipal;
  action: PolicyAction;
  server: PolicyServer;
  clientId?: string;
  client?: PolicyClient;
  requestTime: string | Date;
  grants: PolicyGrant[];
  projectId?: string;
  tool?: PolicyTool;
  toolName?: string;
  emergencyDeny?: boolean | PolicyEmergencyDeny;
  stepUpSatisfied?: boolean;
};

export type PolicyResult = PolicyDecision;

export type PromptPolicyInput = PolicyDecisionInput;

export type PromptPolicyResult = PolicyDecisionResult;

export function evaluatePolicyDecision(input: PolicyDecisionInput, context: PolicyDecisionContext = {}): PolicyDecisionResult {
  const principal = principalFromDecisionInput(input, context);
  if (!principal) {
    return toPolicyDecisionResult(
      decision("deny", "INVALID_SUBJECT", "Policy subject must include an id for its declared subject type.", [])
    );
  }

  return toPolicyDecisionResult(
    evaluatePolicy({
      principal,
      action: input.action,
      clientId: input.client.clientId,
      client: input.client.clientId ? { id: input.client.clientId, displayName: input.client.clientType } : undefined,
      projectId: input.project?.projectId,
      requestTime: input.requestTime,
      server: {
        id: input.server.serverId,
        slug: input.server.serverSlug,
        environment: input.server.environment,
        enabled: input.server.enabled,
        tools: context.serverTools ?? (input.tool ? [input.tool] : undefined),
        riskLevel: input.tool?.riskLevel
      },
      tool: input.tool,
      toolName: input.tool?.name,
      grants: context.grants ?? [],
      emergencyDeny: context.emergencyDeny,
      stepUpSatisfied: context.stepUpSatisfied
    })
  );
}

export const evaluatePromptPolicy = evaluatePolicyDecision;

export function evaluatePolicy(input: PolicyInput): PolicyResult {
  const requestTime = toDate(input.requestTime);
  const emergencyDeny = readEmergencyDeny(input.emergencyDeny);
  const action = normalizePolicyAction(input.action);

  if (emergencyDeny.enabled) {
    const emergencyDecision = evaluateEmergencyDeny(input, emergencyDeny);

    if (emergencyDecision) {
      return emergencyDecision;
    }
  }

  if (action === "admin" && !input.principal.isPlatformAdmin) {
    return decision("deny", "ADMIN_REQUIRES_PLATFORM_ADMIN", "Admin actions require a platform admin principal.", []);
  }

  if (!input.server.enabled) {
    return decision("deny", "SERVER_DISABLED", `Server ${input.server.slug} is disabled.`, []);
  }

  if (action === "admin") {
    return decision("allow", "ADMIN_ALLOW", "Platform admin principal may perform the admin action.", []);
  }

  const toolName = input.toolName ?? input.tool?.name;
  const tool = input.tool;

  if (action === "call_tool" && (!toolName || !tool?.enabled)) {
    return decision("deny", "TOOL_DISABLED", "Tool is disabled or not registered.", []);
  }

  const activeScopedGrants = input.grants.filter((grant) => grantMatchesScope(grant, input, requestTime));
  const activeEnvironmentGrants = activeScopedGrants.filter((grant) => grant.environment === input.server.environment);

  if (input.server.environment === "prod" && activeScopedGrants.length > 0 && activeEnvironmentGrants.length === 0) {
    return decision("deny", "PROD_GRANT_REQUIRED", "Production servers require an active prod grant.", []);
  }

  if (activeEnvironmentGrants.length === 0) {
    return decision("deny", "CONNECT_GRANT_REQUIRED", `No active grant permits connecting to ${input.server.slug}.`, []);
  }

  if (action === "connect") {
    return decision(
      "allow",
      "ALLOW",
      `Principal may connect to ${input.server.slug}.`,
      grantIds(activeEnvironmentGrants)
    );
  }

  if (action === "read_resource" || action === "get_prompt") {
    return decision(
      "allow",
      "ALLOW",
      `Principal may ${action === "read_resource" ? "read resources" : "get prompts"} from ${input.server.slug}.`,
      grantIds(activeEnvironmentGrants)
    );
  }

  if (action === "discover_tool") {
    const discoverableToolNames = discoverableTools(input.server.tools ?? [], activeEnvironmentGrants);

    return decision(
      "allow",
      "ALLOW",
      `Principal may discover ${discoverableToolNames.length} granted tool(s) for ${input.server.slug}.`,
      grantIds(activeEnvironmentGrants),
      { discoverableToolNames }
    );
  }

  if (!toolName || !tool?.enabled) {
    return decision("deny", "TOOL_DISABLED", "Tool is disabled or not registered.", []);
  }

  const toolGrants = activeEnvironmentGrants.filter((grant) => grantAllowsTool(grant, toolName));

  if (toolGrants.length === 0) {
    return decision("deny", "TOOL_GRANT_REQUIRED", `Tool ${toolName} is not granted for ${input.server.slug}.`, []);
  }

  if (requiresExplicitToolGrant(tool.riskLevel)) {
    const explicitToolGrants = toolGrants.filter((grant) => grantExplicitlyAllowsTool(grant, toolName));

    if (explicitToolGrants.length === 0) {
      return decision(
        "deny",
        "EXPLICIT_TOOL_GRANT_REQUIRED",
        `High and critical risk tools require an explicit grant for ${toolName}.`,
        []
      );
    }

    if (!explicitToolGrants.some((grant) => isNonEmptyString(grant.approvedBy))) {
      return decision(
        "needs_approval",
        "APPROVAL_REQUIRED",
        "High and critical risk tools require approval.",
        grantIds(explicitToolGrants),
        { requiresApproval: true, requiresStepUp: tool.riskLevel === "critical" }
      );
    }

    if (tool.riskLevel === "critical" && !input.stepUpSatisfied) {
      return decision(
        "needs_approval",
        "STEP_UP_REQUIRED",
        "Critical-risk tools require step-up confirmation.",
        grantIds(explicitToolGrants),
        { requiresStepUp: true }
      );
    }

    return decision("allow", "ALLOW", `Tool ${toolName} is explicitly granted for this principal.`, grantIds(explicitToolGrants));
  }

  return decision("allow", "ALLOW", "Tool is granted for this principal.", grantIds(toolGrants));
}

export const evaluateAuthorizationPolicy = evaluatePolicy;

export type GatewayPolicyInput = {
  userId: string;
  teamIds: string[];
  projectId?: string;
  clientId: string;
  serverId: string;
  serverSlug: string;
  toolName: string;
  environment: string;
  riskLevel: string;
  requestTime: string;
  allowedTools: string[];
};

export function evaluateGatewayPolicy(input: GatewayPolicyInput): PolicyDecision {
  const environment = readEnvironment(input.environment);
  const riskLevel = readRiskLevel(input.riskLevel);

  if (!environment) {
    return decision("deny", "INVALID_ENVIRONMENT", `Environment ${input.environment} is not recognized.`, []);
  }
  if (!riskLevel) {
    return decision("deny", "INVALID_RISK_LEVEL", `Risk level ${input.riskLevel} is not recognized.`, []);
  }

  return evaluatePolicy({
    principal: {
      subject: input.userId,
      principalType: "user",
      teamIds: input.teamIds,
      teams: input.teamIds
    },
    action: "tools/call",
    projectId: input.projectId,
    requestTime: input.requestTime,
    server: {
      id: input.serverId,
      slug: input.serverSlug,
      environment,
      enabled: true
    },
    tool: {
      name: input.toolName,
      enabled: true,
      riskLevel
    },
    grants: [
      {
        id: "gateway-allowed-tools",
        subjectType: "user",
        subjectId: input.userId,
        projectId: input.projectId,
        serverId: input.serverId,
        allowedTools: input.allowedTools,
        environment,
        enabled: true
      },
      ...input.teamIds.map((teamId) => ({
        id: `gateway-team-${teamId}`,
        subjectType: "team" as const,
        subjectId: teamId,
        projectId: input.projectId,
        serverId: input.serverId,
        allowedTools: input.allowedTools,
        environment,
        enabled: true
      }))
    ]
  });
}

function decision(
  effect: PolicyEffect,
  reasonCode: PolicyReasonCode,
  reason: string,
  matchedGrantIds: string[],
  options: Partial<Pick<PolicyDecision, "requiresApproval" | "requiresStepUp" | "discoverableToolNames">> = {}
): PolicyDecision {
  return {
    effect,
    allowed: effect === "allow",
    reason,
    reasonCode,
    matchedGrantIds,
    requiresApproval: options.requiresApproval ?? false,
    requiresStepUp: options.requiresStepUp ?? false,
    discoverableToolNames: options.discoverableToolNames
  };
}

function principalFromDecisionInput(input: PolicyDecisionInput, context: PolicyDecisionContext): PolicyPrincipal | undefined {
  const teamIds = uniqueStrings(input.subject.teamIds ?? []);
  const subject = subjectIdFromDecisionInput(input, teamIds);

  if (!subject) {
    return undefined;
  }

  return {
    subject,
    principalType: input.subject.type,
    teamIds,
    teams: teamIds,
    groups: context.principal?.groups,
    roles: context.principal?.roles,
    isAdmin: context.principal?.isAdmin,
    isPlatformAdmin: context.principal?.isPlatformAdmin
  };
}

function subjectIdFromDecisionInput(input: PolicyDecisionInput, teamIds: string[]) {
  if (input.subject.type === "user") {
    return input.subject.userId;
  }
  if (input.subject.type === "team") {
    return teamIds[0];
  }

  return input.subject.serviceAccountId;
}

function toPolicyDecisionResult(result: PolicyDecision): PolicyDecisionResult {
  const promptResult: PolicyDecisionResult = {
    allowed: result.allowed,
    reasonCode: result.reasonCode,
    reason: result.reason,
    matchedGrantIds: result.matchedGrantIds
  };

  if (result.requiresApproval) {
    promptResult.requiresApproval = true;
  }
  if (result.requiresStepUp) {
    promptResult.requiresStepUp = true;
  }

  return promptResult;
}

function evaluateEmergencyDeny(input: PolicyInput, emergencyDeny: PolicyEmergencyDeny): PolicyDecision | undefined {
  const toolName = input.toolName ?? input.tool?.name;
  const clientId = input.clientId ?? input.client?.id;
  const reason = emergencyDeny.reason ?? "Emergency deny is enabled for MCP Hub.";

  if (emergencyDeny.global ?? hasNoScopedEmergencyDeny(emergencyDeny)) {
    return decision("deny", "EMERGENCY_DENY", reason, []);
  }
  if (emergencyDeny.highCritical && isHighCritical(input.tool?.riskLevel ?? input.server.riskLevel)) {
    return decision("deny", "EMERGENCY_DENY", reason, []);
  }
  if (emergencyDeny.serverIds?.includes(input.server.id) || emergencyDeny.serverSlugs?.includes(input.server.slug)) {
    return decision("deny", "EMERGENCY_DENY", reason, []);
  }
  if (toolName && emergencyDeny.toolNames?.includes(toolName)) {
    return decision("deny", "EMERGENCY_DENY", reason, []);
  }
  if (emergencyDeny.subjectIds?.includes(input.principal.subject)) {
    return decision("deny", "EMERGENCY_DENY", reason, []);
  }
  if (clientId && emergencyDeny.clientIds?.includes(clientId)) {
    return decision("deny", "EMERGENCY_DENY", reason, []);
  }

  return undefined;
}

function hasNoScopedEmergencyDeny(emergencyDeny: PolicyEmergencyDeny) {
  return (
    emergencyDeny.global === undefined &&
    emergencyDeny.highCritical === undefined &&
    emergencyDeny.serverIds === undefined &&
    emergencyDeny.serverSlugs === undefined &&
    emergencyDeny.toolNames === undefined &&
    emergencyDeny.subjectIds === undefined &&
    emergencyDeny.clientIds === undefined
  );
}

function isHighCritical(riskLevel: RiskLevel | undefined) {
  return riskLevel === "high" || riskLevel === "critical";
}

function normalizePolicyAction(action: PolicyAction): PromptPolicyAction {
  if (action === "tools/list") {
    return "discover_tool";
  }
  if (action === "tools/call") {
    return "call_tool";
  }

  return action;
}

function grantMatchesScope(grant: PolicyGrant, input: PolicyInput, requestTime: Date) {
  return (
    grant.enabled &&
    grant.serverId === input.server.id &&
    grantMatchesProject(grant, input.projectId) &&
    grantMatchesPrincipal(grant, input.principal) &&
    !grantExpired(grant, requestTime)
  );
}

function grantMatchesProject(grant: PolicyGrant, projectId: string | undefined) {
  if (!grant.projectId) {
    return !projectId;
  }

  return projectId !== undefined && grant.projectId === projectId;
}

function grantMatchesPrincipal(grant: PolicyGrant, principal: PolicyPrincipal) {
  if (grant.subjectType === "user") {
    return principal.principalType === "user" && grant.subjectId === principal.subject;
  }
  if (grant.subjectType === "team") {
    const teams = principal.teams ?? [];
    return principal.principalType === "team"
      ? grant.subjectId === principal.subject || principal.teamIds.includes(grant.subjectId) || teams.includes(grant.subjectId)
      : principal.teamIds.includes(grant.subjectId) || teams.includes(grant.subjectId);
  }

  return principal.principalType === "service_account" && grant.subjectId === principal.subject;
}

function grantExpired(grant: PolicyGrant, requestTime: Date) {
  if (!grant.expiresAt) {
    return false;
  }

  const expiresAt = grant.expiresAt instanceof Date ? grant.expiresAt : new Date(grant.expiresAt);

  return Number.isNaN(expiresAt.getTime()) || expiresAt <= requestTime;
}

function grantAllowsTool(grant: PolicyGrant, toolName: string) {
  return grant.allowedTools.includes("*") || grantExplicitlyAllowsTool(grant, toolName);
}

function grantExplicitlyAllowsTool(grant: PolicyGrant, toolName: string) {
  return grant.allowedTools.includes(toolName);
}

function requiresExplicitToolGrant(riskLevel: RiskLevel) {
  return riskLevel === "high" || riskLevel === "critical";
}

function discoverableTools(tools: PolicyTool[], grants: PolicyGrant[]) {
  return tools
    .filter((tool) => tool.enabled && grants.some((grant) => grantAllowsTool(grant, tool.name)))
    .map((tool) => tool.name);
}

function grantIds(grants: PolicyGrant[]) {
  return grants.map((grant) => grant.id);
}

function readEmergencyDeny(emergencyDeny: boolean | PolicyEmergencyDeny | undefined): PolicyEmergencyDeny {
  if (typeof emergencyDeny === "boolean") {
    return { enabled: emergencyDeny };
  }

  return emergencyDeny ?? { enabled: false };
}

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

function readEnvironment(value: string): PolicyEnvironment | undefined {
  if (value === "dev" || value === "stg" || value === "prod" || value === "shared") {
    return value;
  }

  return undefined;
}

function readRiskLevel(value: string): RiskLevel | undefined {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") {
    return value;
  }

  return undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}
