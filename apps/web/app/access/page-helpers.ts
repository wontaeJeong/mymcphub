import type { ApiMcpServer, Environment } from "../../lib/api";

export type AccessRequestDefaults = Readonly<{
  serverId?: string;
  requestedTools: string;
  environment: Environment;
}>;

export type QueryParams = Record<string, string | string[] | undefined>;

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
    requestedTools: readRequestedTools(readFirst(searchParams, "requestedTools")),
    environment: readEnvironment(readFirst(searchParams, "environment")) ?? server?.environment ?? "dev",
  };
}

function readFirst(searchParams: QueryParams, field: string) {
  const value = searchParams[field];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function readRequestedTools(value: string) {
  return value
    .split(",")
    .map((tool) => tool.trim())
    .filter((tool) => tool.length > 0)
    .join(", ");
}

function readEnvironment(value: string): Environment | undefined {
  if (value === "dev" || value === "stg" || value === "prod" || value === "shared") {
    return value;
  }

  return undefined;
}
