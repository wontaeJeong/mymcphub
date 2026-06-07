import type { ApiGrant, ApiMcpServer, ApiMcpTool } from "../../lib/api";

export type ToolTestOption = Readonly<{
  value: string;
  label: string;
  serverId: string;
  serverSlug: string;
  toolName: string;
  riskLevel: ApiMcpTool["riskLevel"];
  enabled: boolean;
}>;

export function buildGrantStatus(tools: ApiMcpTool[], grants: Pick<ApiGrant, "serverId" | "allowedTools" | "enabled" | "subjectType" | "subjectId">[]) {
  const statuses = new Map<string, string>();
  for (const tool of tools) {
    const matching = grants.filter((grant) => grant.enabled && grant.serverId === tool.serverId && (grant.allowedTools.includes(tool.name) || grant.allowedTools.includes("*")));
    statuses.set(`${tool.serverId}:${tool.name}`, matching.length > 0 ? `${matching.length} active grant${matching.length === 1 ? "" : "s"}: ${matching.map((grant) => `${grant.subjectType}:${grant.subjectId}`).join(", ")}` : "No active grant found");
  }

  return statuses;
}

export function buildToolTestOptions(servers: ApiMcpServer[], tools: ApiMcpTool[]): ToolTestOption[] {
  const serverById = new Map(servers.map((server) => [server.id, server]));

  return tools.flatMap((tool) => {
    const server = serverById.get(tool.serverId);
    if (!server) {
      return [];
    }

    return [{
      value: `${server.id}::${server.slug}::${tool.name}`,
      label: `${server.displayName} · ${tool.name}`,
      serverId: server.id,
      serverSlug: server.slug,
      toolName: tool.name,
      riskLevel: tool.riskLevel,
      enabled: tool.enabled
    }];
  });
}
