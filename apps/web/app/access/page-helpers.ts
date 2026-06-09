import type { ApiApproval, Environment } from "../../lib/api";
import type { AccessStatusSession } from "../../lib/access-status";

export type AccessRequestPrefill = Readonly<{
  serverId: string;
  requestedTools: string;
  environment: Environment | "";
  reason: string;
}>;

export const emptyAccessRequestPrefill: AccessRequestPrefill = {
  serverId: "",
  requestedTools: "",
  environment: "",
  reason: "",
};

export function readAccessRequestPrefill(
  searchParams: Record<string, string | string[] | undefined> = {},
): AccessRequestPrefill {
  return {
    serverId: readParam(searchParams, "serverId"),
    requestedTools: readRequestedTools(searchParams),
    environment: readEnvironmentParam(searchParams),
    reason: readParam(searchParams, "reason"),
  };
}

export function filterVisibleApprovals(
  approvals: readonly ApiApproval[],
  session: AccessStatusSession | undefined,
) {
  if (!session) {
    return [];
  }

  const subjectIds = new Set([
    session.userId,
    ...session.teamIds,
    ...session.teams,
  ].filter((value) => value.length > 0));

  return approvals.filter(
    (approval) =>
      approval.requesterId === session.userId || subjectIds.has(approval.subjectId),
  );
}

export function filterPendingApprovals(approvals: readonly ApiApproval[]) {
  return approvals.filter((approval) => approval.status === "pending");
}

function readRequestedTools(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const tools = splitCsv(readParam(searchParams, "tools"));
  if (tools.length > 0) {
    return tools.join(", ");
  }

  return readParam(searchParams, "toolName");
}

function readEnvironmentParam(
  searchParams: Record<string, string | string[] | undefined>,
): Environment | "" {
  const value = readParam(searchParams, "environment");
  return value === "dev" || value === "stg" || value === "prod" || value === "shared"
    ? value
    : "";
}

function readParam(
  searchParams: Record<string, string | string[] | undefined>,
  field: string,
) {
  const value = searchParams[field];
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
