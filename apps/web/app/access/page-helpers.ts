import type { ApiApproval, ApiMcpServer, Environment } from "../../lib/api";
import type { AccessStatusSession } from "../../lib/access-status";

export type AccessRequestPrefill = Readonly<{
  serverId: string;
  requestedTools: string;
  environment: Environment | "";
  reason: string;
}>;

export type AccessRequestDefaults = Readonly<{
  serverId?: string;
  requestedTools: string;
  environment: Environment;
}>;

export type QueryParams = Record<string, string | string[] | undefined>;

export const emptyAccessRequestPrefill: AccessRequestPrefill = {
  serverId: "",
  requestedTools: "",
  environment: "",
  reason: "",
};

export function readAccessRequestPrefill(
  searchParams: QueryParams = {},
): AccessRequestPrefill {
  return {
    serverId: readFirst(searchParams, "serverId"),
    requestedTools: readRequestedTools(searchParams),
    environment: readEnvironment(readFirst(searchParams, "environment")) ?? "",
    reason: readFirst(searchParams, "reason"),
  };
}

export function readAccessRequestDefaults(
  searchParams: QueryParams,
  servers: ApiMcpServer[],
): AccessRequestDefaults {
  const requestedServerId = readFirst(searchParams, "serverId");
  const selectedServer = requestedServerId
    ? servers.find((server) => server.id === requestedServerId)
    : undefined;
  const server = selectedServer ?? servers[0];

  return {
    serverId: server?.id,
    requestedTools: readRequestedTools(searchParams),
    environment: readEnvironment(readFirst(searchParams, "environment")) ?? server?.environment ?? "dev",
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

function readRequestedTools(searchParams: QueryParams) {
  const requestedTools = splitCsv(readFirst(searchParams, "requestedTools"));
  if (requestedTools.length > 0) {
    return requestedTools.join(", ");
  }

  const tools = splitCsv(readFirst(searchParams, "tools"));
  if (tools.length > 0) {
    return tools.join(", ");
  }

  return readFirst(searchParams, "toolName");
}

function readFirst(searchParams: QueryParams, field: string) {
  const value = searchParams[field];
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function readEnvironment(value: string): Environment | undefined {
  if (value === "dev" || value === "stg" || value === "prod" || value === "shared") {
    return value;
  }

  return undefined;
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
