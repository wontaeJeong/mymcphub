import { evaluatePolicy, type PolicyAction, type PolicyDecision, type PolicyGrant } from "@mcp-hub/policy";

import type { GatewayPrincipal, GatewayServer, GatewayTool } from "./types";

export function authorizeConnect(server: GatewayServer, principal: GatewayPrincipal) {
  return evaluateGatewayPolicyAction(server, principal, "connect");
}

export function allowedToolsForPrincipal(server: GatewayServer, principal: GatewayPrincipal) {
  const decision = authorizeToolDiscovery(server, principal);
  const discoverableToolNames = decision.discoverableToolNames ?? [];

  return server.tools.filter((tool) => discoverableToolNames.includes(tool.name));
}

export function authorizeToolDiscovery(server: GatewayServer, principal: GatewayPrincipal) {
  return evaluateGatewayPolicyAction(server, principal, "discover_tool");
}

export function authorizeToolCall(
  server: GatewayServer,
  principal: GatewayPrincipal,
  tool: GatewayTool | undefined
) {
  return evaluateGatewayPolicyAction(server, principal, "call_tool", tool);
}

export function authorizeResourceRead(server: GatewayServer, principal: GatewayPrincipal) {
  return evaluateGatewayPolicyAction(server, principal, "read_resource");
}

export function authorizePromptGet(server: GatewayServer, principal: GatewayPrincipal) {
  return evaluateGatewayPolicyAction(server, principal, "get_prompt");
}

export function authorizeAdminAction(server: GatewayServer, principal: GatewayPrincipal) {
  return evaluateGatewayPolicyAction(server, principal, "admin");
}

function evaluateGatewayPolicyAction(
  server: GatewayServer,
  principal: GatewayPrincipal,
  action: PolicyAction,
  tool?: GatewayTool
): PolicyDecision {
  return evaluatePolicy({
    principal: {
      subject: principal.userId,
      principalType: principal.principalType,
      teamIds: principal.teamIds,
      teams: principal.teamIds,
      groups: principal.groups,
      roles: principal.roles,
      isPlatformAdmin: principal.isPlatformAdmin
    },
    action,
    clientId: principal.clientId,
    projectId: principal.projectId,
    requestTime: new Date().toISOString(),
    server: {
      id: server.id,
      slug: server.slug,
      environment: server.environment,
      enabled: server.enabled,
      tools: server.tools,
      riskLevel: maximumRiskLevel(server.tools)
    },
    tool,
    toolName: tool?.name,
    grants: server.grants.map((grant, index): PolicyGrant => ({
      id: grant.id ?? `${server.id}:grant:${index}`,
      subjectType: grant.subjectType,
      subjectId: grant.subjectId,
      projectId: grant.projectId,
      serverId: server.id,
      allowedTools: grant.allowedTools,
      environment: grant.environment ?? server.environment,
      expiresAt: grant.expiresAt,
      approvedBy: grant.approvedBy,
      enabled: grant.enabled ?? true
    })),
    emergencyDeny: server.emergencyDeny
  });
}

function maximumRiskLevel(tools: GatewayTool[]) {
  if (tools.some((tool) => tool.riskLevel === "critical")) {
    return "critical";
  }
  if (tools.some((tool) => tool.riskLevel === "high")) {
    return "high";
  }
  if (tools.some((tool) => tool.riskLevel === "medium")) {
    return "medium";
  }

  return "low";
}
