import type { ApiMcpServer, ClientConfigKind } from "../../lib/api";

export type ClientConfigInitialValues = Readonly<{
  serverId?: string;
  client: ClientConfigKind;
  profile: string;
}>;

export type QueryParams = Record<string, string | string[] | undefined>;

export function readClientConfigInitialValues(
  searchParams: QueryParams,
  servers: ApiMcpServer[],
): ClientConfigInitialValues {
  const requestedServerId = readFirst(searchParams, "serverId");
  const selectedServer = requestedServerId
    ? servers.find((server) => server.id === requestedServerId)
    : undefined;

  return {
    serverId: selectedServer?.id ?? servers[0]?.id,
    client: readClient(readFirst(searchParams, "client")) ?? "opencode",
    profile: readProfile(readFirst(searchParams, "profile")),
  };
}

function readFirst(searchParams: QueryParams, field: string) {
  const value = searchParams[field];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function readClient(value: string): ClientConfigKind | undefined {
  if (
    value === "generic" ||
    value === "opencode" ||
    value === "claude-code" ||
    value === "codex" ||
    value === "vscode"
  ) {
    return value;
  }

  return undefined;
}

function readProfile(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "local";
}
