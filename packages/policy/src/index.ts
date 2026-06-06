export type PolicyEffect = "allow" | "deny" | "needs_approval";

export type PolicyDecision = {
  effect: PolicyEffect;
  reason: string;
};

export const denyByDefault: PolicyDecision = {
  effect: "deny",
  reason: "No policy rule matched."
};
