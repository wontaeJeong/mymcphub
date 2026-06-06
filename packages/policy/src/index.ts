export type PolicyEffect = "allow" | "deny" | "needs_approval";

export type PolicyDecision = {
  effect: PolicyEffect;
  reason: string;
};

export const denyByDefault: PolicyDecision = {
  effect: "deny",
  reason: "No policy rule matched."
};

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
  if (!input.allowedTools.includes(input.toolName)) {
    return {
      effect: "deny",
      reason: `Tool ${input.toolName} is not granted for ${input.serverSlug}.`
    };
  }

  if (input.riskLevel === "critical") {
    return {
      effect: "needs_approval",
      reason: "Critical-risk tools require approval."
    };
  }

  return {
    effect: "allow",
    reason: "Tool is granted for this principal."
  };
}
