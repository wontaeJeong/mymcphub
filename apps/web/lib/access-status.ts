import type {
  ApiApproval,
  ApiGrant,
  ApiMcpServer,
  ApiMcpTool,
  ApiServerHealth,
  AuthContext,
  Environment,
} from "./api";

export type AccessStatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export type AccessStatusKind =
  | "accessible"
  | "request_required"
  | "pending_approval"
  | "disabled"
  | "quarantined"
  | "unknown";

export type AccessStatus = Readonly<{
  status: AccessStatusKind;
  label: string;
  tone: AccessStatusTone;
  actionHint: string;
  matchedGrantIds: string[];
  pendingApprovalIds: string[];
  wildcardGrant: boolean;
}>;

export type AccessStatusSession = Pick<
  AuthContext,
  "userId" | "teamIds" | "teams" | "projectId"
>;

export type AccessStatusInput = Readonly<{
  server?: ApiMcpServer;
  tool?: ApiMcpTool;
  grants?: readonly ApiGrant[];
  approvals?: readonly ApiApproval[];
  session?: AccessStatusSession;
  health?: ApiServerHealth;
  now?: Date;
}>;

export type AccessRequestLinkInput = Readonly<{
  serverId: string;
  toolName?: string;
  tools?: readonly string[];
  environment?: Environment;
  reason?: string;
}>;

const wildcardTool = "*";

export function evaluateAccessStatus({
  server,
  tool,
  grants,
  approvals,
  session,
  health,
  now = new Date(),
}: AccessStatusInput): AccessStatus {
  if (!server) {
    return buildStatus(
      "unknown",
      "상태 확인 불가",
      "neutral",
      "서버 메타데이터가 없어 접근 가능 여부를 계산할 수 없습니다.",
    );
  }

  if (server.quarantined || server.visibility === "quarantined") {
    return buildStatus(
      "quarantined",
      "격리됨",
      "danger",
      "격리된 서버는 관리자 검토가 끝날 때까지 요청하거나 사용할 수 없습니다.",
    );
  }

  if (!server.enabled) {
    return buildStatus(
      "disabled",
      "서버 비활성",
      "danger",
      "서버가 비활성 상태입니다. 관리자가 활성화한 뒤 접근을 요청하세요.",
    );
  }

  if (tool && !tool.enabled) {
    return buildStatus(
      "disabled",
      "도구 비활성",
      "danger",
      "도구가 비활성 상태입니다. 관리자가 도구를 활성화해야 사용할 수 있습니다.",
    );
  }

  if (!session) {
    return buildStatus(
      "unknown",
      "세션 확인 필요",
      "neutral",
      "현재 사용자 또는 팀 식별자를 확인할 수 없어 권한을 계산하지 못했습니다.",
    );
  }

  if (!grants) {
    return buildStatus(
      "unknown",
      "권한 확인 불가",
      "neutral",
      "권한 API 결과가 없어 접근 가능 여부를 계산하지 못했습니다.",
    );
  }

  const subjectIds = visibleSubjectIds(session);
  const matchingGrants = grants.filter((grant) =>
    grantMatchesTarget(grant, server, tool, subjectIds, session.projectId, now),
  );

  if (matchingGrants.length > 0) {
    const wildcardGrant = matchingGrants.some((grant) =>
      grant.allowedTools.includes(wildcardTool),
    );
    const grantLabel = tool ? "사용 가능" : "일부 도구 사용 가능";
    const wildcardHint = wildcardGrant
      ? " 와일드카드 grant(*)가 이 서버의 도구 범위를 허용합니다."
      : "";

    return {
      status: "accessible",
      label: grantLabel,
      tone: "success",
      actionHint: `${matchingGrants.length}개 활성 grant가 현재 주체, 프로젝트, 환경, 도구 범위와 일치합니다.${wildcardHint}${healthHint(health)}`,
      matchedGrantIds: matchingGrants.map((grant) => grant.id),
      pendingApprovalIds: [],
      wildcardGrant,
    };
  }

  const matchingApprovals = approvals
    ? approvals.filter((approval) =>
      approvalMatchesTarget(
        approval,
        server,
        tool,
        subjectIds,
        session.projectId,
      ),
    )
    : [];

  if (matchingApprovals.length > 0) {
    return {
      status: "pending_approval",
      label: "승인 대기 중",
      tone: "warning",
      actionHint: `${matchingApprovals.length}개 승인 요청이 이미 대기 중입니다. 중복 요청 대신 승인 대기열을 확인하세요.${healthHint(health)}`,
      matchedGrantIds: [],
      pendingApprovalIds: matchingApprovals.map((approval) => approval.id),
      wildcardGrant: false,
    };
  }

  return buildStatus(
    "request_required",
    "요청 필요",
    "warning",
    approvals
      ? `일치하는 활성 grant 또는 대기 중인 승인 요청이 없습니다.${healthHint(health)}`
      : `일치하는 활성 grant가 없습니다. 승인 대기 상태 API 결과는 확인하지 못했습니다.${healthHint(health)}`,
  );
}

export function buildToolAccessStatusMap(
  tools: readonly ApiMcpTool[],
  input: Omit<AccessStatusInput, "tool">,
) {
  const statuses = new Map<string, AccessStatus>();
  for (const tool of tools) {
    statuses.set(
      accessToolKey(tool),
      evaluateAccessStatus({ ...input, tool }),
    );
  }
  return statuses;
}

export function accessToolKey(tool: Pick<ApiMcpTool, "serverId" | "name">) {
  return `${tool.serverId}:${tool.name}`;
}

export function buildAccessRequestHref({
  serverId,
  toolName,
  tools,
  environment,
  reason,
}: AccessRequestLinkInput) {
  const params = new URLSearchParams({ serverId });
  const requestedTools = tools?.filter((tool) => tool.length > 0) ?? [];

  if (requestedTools.length > 0) {
    params.set("tools", requestedTools.join(","));
  } else if (toolName) {
    params.set("toolName", toolName);
  }

  if (environment) {
    params.set("environment", environment);
  }

  if (reason) {
    params.set("reason", reason);
  }

  return `/user/access?${params.toString()}`;
}

export function isHighOrCriticalRisk(riskLevel: ApiMcpServer["riskLevel"]) {
  return riskLevel === "high" || riskLevel === "critical";
}

export function toolScopeMatches(
  allowedTools: readonly string[],
  toolName: string,
) {
  return allowedTools.includes(wildcardTool) || allowedTools.includes(toolName);
}

function buildStatus(
  status: AccessStatusKind,
  label: string,
  tone: AccessStatusTone,
  actionHint: string,
): AccessStatus {
  return {
    status,
    label,
    tone,
    actionHint,
    matchedGrantIds: [],
    pendingApprovalIds: [],
    wildcardGrant: false,
  };
}

function visibleSubjectIds(session: AccessStatusSession) {
  return new Set([
    session.userId,
    ...session.teamIds,
    ...session.teams,
  ].filter((value) => value.length > 0));
}

function grantMatchesTarget(
  grant: ApiGrant,
  server: ApiMcpServer,
  tool: ApiMcpTool | undefined,
  subjectIds: ReadonlySet<string>,
  projectId: string | undefined,
  now: Date,
) {
  return grant.enabled
    && grant.serverId === server.id
    && subjectIds.has(grant.subjectId)
    && projectMatches(grant.projectId, projectId)
    && environmentMatches(grant.environment, server.environment)
    && grantNotExpired(grant, now)
    && (!tool || toolScopeMatches(grant.allowedTools, tool.name));
}

function approvalMatchesTarget(
  approval: ApiApproval,
  server: ApiMcpServer,
  tool: ApiMcpTool | undefined,
  subjectIds: ReadonlySet<string>,
  projectId: string | undefined,
) {
  return approval.status === "pending"
    && approval.serverId === server.id
    && (subjectIds.has(approval.subjectId) || subjectIds.has(approval.requesterId))
    && projectMatches(approval.projectId, projectId)
    && environmentMatches(approval.environment, server.environment)
    && (!tool || toolScopeMatches(approval.requestedTools, tool.name));
}

function projectMatches(value: string, projectId: string | undefined) {
  return !projectId || value === projectId;
}

function environmentMatches(value: Environment, serverEnvironment: Environment) {
  return value === serverEnvironment || value === "shared" || serverEnvironment === "shared";
}

function grantNotExpired(grant: ApiGrant, now: Date) {
  if (!grant.expiresAt) {
    return true;
  }

  const expiresAt = new Date(grant.expiresAt);
  return Number.isNaN(expiresAt.getTime()) || expiresAt > now;
}

function healthHint(health: ApiServerHealth | undefined) {
  if (!health) {
    return " 서버 상태는 아직 확인되지 않았습니다.";
  }

  if (health.status === "healthy") {
    return " 서버 상태는 정상입니다.";
  }

  if (health.status === "degraded") {
    return " 서버 상태가 저하되어 호출 전 주의가 필요합니다.";
  }

  return " 서버 상태가 비정상이라 권한과 별도로 운영 확인이 필요합니다.";
}
