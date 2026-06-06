import type { ApiApproval } from "../../lib/api";

export function splitApprovalQueue(approvals: ApiApproval[]) {
  return {
    pending: approvals.filter((approval) => approval.status === "pending"),
    decided: approvals.filter((approval) => approval.status !== "pending")
  };
}
