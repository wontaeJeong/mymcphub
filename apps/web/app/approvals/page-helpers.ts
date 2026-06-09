import type { ApprovalDecisionContext } from "../../components/tables";
import type { ApiApproval, ApiGrant, ApiMcpServer, ApiMcpTool, Environment } from "../../lib/api";
import { isHighOrCriticalRisk, toolScopeMatches } from "../../lib/access-status";

export function splitApprovalQueue(approvals: ApiApproval[]) {
  return {
    pending: approvals.filter((approval) => approval.status === "pending"),
    decided: approvals.filter((approval) => approval.status !== "pending")
  };
}

export function buildApprovalDecisionContexts(
  approvals: readonly ApiApproval[],
  servers: readonly ApiMcpServer[],
  toolsByServerId: ReadonlyMap<string, readonly ApiMcpTool[]>,
  grants: readonly ApiGrant[],
) {
  const serverById = new Map(servers.map((server) => [server.id, server]));
  const contexts = new Map<string, ApprovalDecisionContext>();

  for (const approval of approvals) {
    const server = serverById.get(approval.serverId);
    const tools = toolsByServerId.get(approval.serverId) ?? [];
    const requestedToolRisks = buildRequestedToolRisks(approval, tools, server);
    const reviewCommentRequired = Boolean(server && isHighOrCriticalRisk(server.riskLevel))
      || requestedToolRisks.some((tool) => tool.riskLevel && isHighOrCriticalRisk(tool.riskLevel));

    contexts.set(approval.id, {
      serverDisplayName: server?.displayName,
      serverCategory: server?.category ?? server?.visibility ?? "other",
      serverEnvironment: server?.environment,
      serverRiskLevel: server?.riskLevel,
      requestedToolRisks,
      grantOverlaps: matchingGrantOverlaps(approval, grants),
      reviewCommentRequired,
    });
  }

  return contexts;
}

function buildRequestedToolRisks(
  approval: ApiApproval,
  tools: readonly ApiMcpTool[],
  server: ApiMcpServer | undefined,
): ApprovalDecisionContext["requestedToolRisks"] {
  if (approval.requestedTools.includes("*")) {
    if (tools.length > 0) {
      return tools.map((tool) => ({
        toolName: tool.name,
        riskLevel: tool.riskLevel,
        enabled: tool.enabled,
      }));
    }

    return [{
      toolName: "*",
      riskLevel: server?.riskLevel,
      enabled: server?.enabled,
    }];
  }

  return approval.requestedTools.map((toolName) => {
    const tool = tools.find((candidate) => candidate.name === toolName);
    return {
      toolName,
      riskLevel: tool?.riskLevel,
      enabled: tool?.enabled,
    };
  });
}

function matchingGrantOverlaps(
  approval: ApiApproval,
  grants: readonly ApiGrant[],
): ApprovalDecisionContext["grantOverlaps"] {
  return grants
    .filter((grant) =>
      grant.enabled
      && grant.serverId === approval.serverId
      && grant.subjectType === approval.subjectType
      && grant.subjectId === approval.subjectId
      && grant.projectId === approval.projectId
      && environmentMatches(grant.environment, approval.environment)
      && toolsOverlap(grant.allowedTools, approval.requestedTools),
    )
    .map((grant) => ({
      grantId: grant.id,
      subjectId: grant.subjectId,
      allowedTools: grant.allowedTools,
      wildcard: grant.allowedTools.includes("*"),
    }));
}

function toolsOverlap(allowedTools: readonly string[], requestedTools: readonly string[]) {
  return requestedTools.includes("*")
    || allowedTools.includes("*")
    || requestedTools.some((toolName) => toolScopeMatches(allowedTools, toolName));
}

function environmentMatches(left: Environment, right: Environment) {
  return left === right || left === "shared" || right === "shared";
}
