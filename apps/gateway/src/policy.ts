import { evaluateGatewayPolicy } from "@mcp-hub/policy";

import type { GatewayPrincipal, GatewayServer, GatewayTool } from "./types";

export function allowedToolsForPrincipal(server: GatewayServer, principal: GatewayPrincipal) {
  const allowedToolNames = new Set<string>();

  for (const grant of server.grants) {
    if (grant.subjectType === "user" && grant.subjectId === principal.userId) {
      grant.allowedTools.forEach((tool) => allowedToolNames.add(tool));
    }
    if (grant.subjectType === "team" && principal.teamIds.includes(grant.subjectId)) {
      grant.allowedTools.forEach((tool) => allowedToolNames.add(tool));
    }
  }

  return server.tools.filter((tool) => tool.enabled && allowedToolNames.has(tool.name));
}

export function authorizeToolCall(
  server: GatewayServer,
  principal: GatewayPrincipal,
  tool: GatewayTool | undefined
) {
  if (!tool || !tool.enabled) {
    return {
      effect: "deny" as const,
      reason: "Tool is disabled or not registered."
    };
  }

  return evaluateGatewayPolicy({
    userId: principal.userId,
    teamIds: principal.teamIds,
    clientId: principal.clientId,
    serverId: server.id,
    serverSlug: server.slug,
    toolName: tool.name,
    environment: server.environment,
    riskLevel: tool.riskLevel,
    requestTime: new Date().toISOString(),
    allowedTools: allowedToolsForPrincipal(server, principal).map((allowedTool) => allowedTool.name)
  });
}
