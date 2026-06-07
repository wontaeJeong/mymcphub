import { EmptyState } from "@mcp-hub/ui";

import { approveApprovalAction, rejectApprovalAction } from "../actions";
import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { ApprovalTable } from "../../components/tables";
import type { ApiApproval } from "../../lib/api";
import { listApprovals } from "../../lib/api";
import { loadResult } from "../../lib/result";
import { splitApprovalQueue } from "./page-helpers";

export async function ApprovalsPageContent() {
  const approvals = await loadResult(listApprovals());
  const { pending, decided } = approvals.ok ? splitApprovalQueue(approvals.data.items) : { pending: [], decided: [] };

  return (
    <div className="page-stack">
      <PageHero eyebrow="Approvals" title="Decide access before it becomes risk." description="Approve or reject pending requests with the subject, server, tools, reason, and expiry visible before action." />
      <section>
        <SectionHeader title="Pending approvals" description="Review the requested scope, then approve with allowed tools and expiry or reject with a clear comment." />
        {approvals.ok && pending.length > 0 ? <ApprovalTable approvals={pending} actionSlot={ApprovalActions} /> : approvals.ok ? <EmptyState title="Queue is clear" description="There are no pending approvals." /> : <ErrorState message={approvals.error} />}
      </section>
      <section>
        <SectionHeader title="Decision history" description="Recently approved, rejected, cancelled, or expired requests." />
        {approvals.ok && decided.length > 0 ? <ApprovalTable approvals={decided} /> : approvals.ok ? <EmptyState title="No decisions yet" description="Approved and rejected requests will appear here." /> : null}
      </section>
    </div>
  );
}

function ApprovalActions(approval: ApiApproval) {
  return (
    <div className="decision-inputs">
      <form className="grid" action={approveApprovalAction}>
        <input type="hidden" name="approvalId" value={approval.id} />
        <div className="field">
          <label htmlFor={`allowedTools-${approval.id}`}>Allowed tools</label>
          <input id={`allowedTools-${approval.id}`} name="allowedTools" defaultValue={approval.requestedTools.join(", ")} placeholder="Comma-separated tools" />
        </div>
        <div className="field">
          <label htmlFor={`expiresAt-${approval.id}`}>Grant expiry</label>
          <input id={`expiresAt-${approval.id}`} name="expiresAt" defaultValue={approval.requestedExpiresAt ?? ""} placeholder="Optional ISO timestamp" />
        </div>
        <div className="field">
          <label htmlFor={`approveComment-${approval.id}`}>Review comment</label>
          <textarea id={`approveComment-${approval.id}`} name="reviewComment" placeholder="Approval rationale" />
        </div>
        <button className="button" type="submit">Approve</button>
      </form>
      <form className="grid" action={rejectApprovalAction}>
        <input type="hidden" name="approvalId" value={approval.id} />
        <div className="field">
          <label htmlFor={`rejectComment-${approval.id}`}>Review comment</label>
          <textarea id={`rejectComment-${approval.id}`} name="reviewComment" placeholder="Rejection rationale" />
        </div>
        <button className="button button--danger" type="submit">Reject</button>
      </form>
    </div>
  );
}
