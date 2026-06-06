import { EmptyState } from "@mcp-hub/ui";

import { approveApprovalAction, rejectApprovalAction } from "../actions";
import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { ApprovalTable } from "../../components/tables";
import type { ApiApproval } from "../../lib/api";
import { listApprovals } from "../../lib/api";
import { loadResult } from "../../lib/result";

export default async function ApprovalsPage() {
  const approvals = await loadResult(listApprovals());
  const pending = approvals.ok ? approvals.data.items.filter((approval) => approval.status === "pending") : [];
  const decided = approvals.ok ? approvals.data.items.filter((approval) => approval.status !== "pending") : [];

  return (
    <div className="page-stack">
      <PageHero eyebrow="Approval queue" title="Decide access before it becomes risk." description="Approve or reject pending approval requests with Control Plane server actions and visible prompt-required decision context." />
      <section>
        <SectionHeader title="Pending approvals" description="POST approve/reject decisions to /api/approvals/:approvalId. Allowed-tools, expiry, and decision reason fields are shown as Control Plane API pending fields because prompt-05 approve/reject endpoints do not consume them yet." />
        {approvals.ok && pending.length > 0 ? <ApprovalTable approvals={pending} actionSlot={ApprovalActions} /> : approvals.ok ? <EmptyState title="Queue is clear" description="There are no pending approvals." /> : <ErrorState message={approvals.error} />}
      </section>
      <section>
        <SectionHeader title="Decision history" description="Recently decided requests returned by the approvals endpoint." />
        {approvals.ok && decided.length > 0 ? <ApprovalTable approvals={decided} /> : approvals.ok ? <EmptyState title="No decisions yet" description="Approved and rejected requests will appear here." /> : null}
      </section>
    </div>
  );
}

function ApprovalActions(approval: ApiApproval) {
  return (
    <div className="decision-inputs">
      <p className="muted">Control Plane API pending fields below are visible for prompt 05 review, but current approve/reject endpoints accept only the decision action.</p>
      <form className="grid" action={approveApprovalAction}>
        <input type="hidden" name="approvalId" value={approval.id} />
        <div className="field">
          <label htmlFor={`allowedTools-${approval.id}`}>Allowed tools pending field</label>
          <input id={`allowedTools-${approval.id}`} name="allowedToolsPending" defaultValue={approval.toolName ?? ""} placeholder="Comma-separated tools" />
        </div>
        <div className="field">
          <label htmlFor={`expiresAt-${approval.id}`}>Expiry pending field</label>
          <input id={`expiresAt-${approval.id}`} name="expiresAtPending" placeholder="Optional ISO timestamp" />
        </div>
        <div className="field">
          <label htmlFor={`approveReason-${approval.id}`}>Decision reason pending field</label>
          <textarea id={`approveReason-${approval.id}`} name="decisionReasonPending" placeholder="Approval rationale" />
        </div>
        <button className="button" type="submit">Approve</button>
      </form>
      <form className="grid" action={rejectApprovalAction}>
        <input type="hidden" name="approvalId" value={approval.id} />
        <div className="field">
          <label htmlFor={`rejectReason-${approval.id}`}>Reject reason pending field</label>
          <textarea id={`rejectReason-${approval.id}`} name="rejectReasonPending" placeholder="Rejection rationale" />
        </div>
        <button className="button button--danger" type="submit">Reject</button>
      </form>
    </div>
  );
}
