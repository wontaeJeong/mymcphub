import { EmptyState, StatusPill, Surface } from "@mcp-hub/ui";

import { approveApprovalAction, rejectApprovalAction } from "../actions";
import { PageHero, SectionHeader } from "../../components/chrome";
import { formatDate, formatEnvironment, formatRiskLevel, riskTone } from "../../components/format";
import { ErrorState } from "../../components/states";
import { ApprovalTable, type ApprovalDecisionContext } from "../../components/tables";
import type { ApiApproval } from "../../lib/api";
import { listApprovals, listGrants, listServers, listTools } from "../../lib/api";
import { loadResult } from "../../lib/result";
import { buildApprovalDecisionContexts, splitApprovalQueue } from "./page-helpers";

export async function ApprovalsPageContent() {
  const approvalsPromise = loadResult(listApprovals());
  const serversPromise = loadResult(listServers());
  const grantsPromise = loadResult(listGrants());
  const [approvals, servers, grants] = await Promise.all([
    approvalsPromise,
    serversPromise,
    grantsPromise,
  ]);
  const approvalItems = approvals.ok ? approvals.data.items : [];
  const serverItems = servers.ok ? servers.data.items : [];
  const serverIds = [...new Set(approvalItems.map((approval) => approval.serverId))];
  const toolEntries = await Promise.all(
    serverIds.map(async (serverId) => [serverId, await loadResult(listTools(serverId))] as const),
  );
  const toolsByServerId = new Map(
    toolEntries.flatMap(([serverId, result]) =>
      result.ok ? [[serverId, result.data.items] as const] : [],
    ),
  );
  const contextByApprovalId = approvals.ok
    ? buildApprovalDecisionContexts(
      approvalItems,
      serverItems,
      toolsByServerId,
      grants.ok ? grants.data.items : [],
    )
    : new Map<string, ApprovalDecisionContext>();
  const serverNameById = new Map(serverItems.map((server) => [server.id, server.displayName]));
  const { pending, decided } = approvals.ok ? splitApprovalQueue(approvals.data.items) : { pending: [], decided: [] };

  return (
    <div className="page-stack">
      <PageHero eyebrow="승인 대기열" title="위험이 되기 전에 접근을 결정하세요." description="제어 플레인 서버 액션과 명확한 결정 컨텍스트로 대기 중인 승인 요청을 승인하거나 거절합니다." />
      {!servers.ok ? <ErrorState title="서버 컨텍스트 사용 불가" message={servers.error} /> : null}
      {!grants.ok ? <ErrorState title="기존 권한 겹침 사용 불가" message={grants.error} /> : null}
      <section>
        <SectionHeader title="대기 중인 승인" description="요청 맥락을 먼저 확인한 뒤 승인 또는 거절 흐름을 선택합니다." />
        {approvals.ok && pending.length > 0 ? <ApprovalReviewCards approvals={pending} serverNameById={serverNameById} contextByApprovalId={contextByApprovalId} /> : approvals.ok ? <EmptyState title="대기열 비어 있음" description="대기 중인 승인 요청이 없습니다." /> : <ErrorState message={approvals.error} />}
      </section>
      <section>
        <SectionHeader title="결정 기록" description="승인 엔드포인트가 반환한 최근 결정 요청입니다." />
        {approvals.ok && decided.length > 0 ? <ApprovalTable approvals={decided} serverNameById={serverNameById} contextByApprovalId={contextByApprovalId} /> : approvals.ok ? <EmptyState title="아직 결정 없음" description="승인 및 거절된 요청이 여기에 표시됩니다." /> : null}
      </section>
    </div>
  );
}

function ApprovalReviewCards({
  approvals,
  serverNameById,
  contextByApprovalId,
}: Readonly<{
  approvals: ApiApproval[];
  serverNameById: Map<string, string>;
  contextByApprovalId: Map<string, ApprovalDecisionContext>;
}>) {
  return (
    <div className="grid">
      {approvals.map((approval) => {
        const context = contextByApprovalId.get(approval.id);
        const ticketUrl = safeExternalUrl(approval.ticketUrl);
        return (
          <Surface key={approval.id}>
            <div className="section-header">
              <div>
                <p className="eyebrow">승인 검토</p>
                <h2>{context?.serverDisplayName ?? serverNameById.get(approval.serverId) ?? "서버 확인 필요"}</h2>
                <p>{approval.reason}</p>
              </div>
              <div className="actions">
                {context?.serverRiskLevel ? <StatusPill tone={riskTone(context.serverRiskLevel)}>{formatRiskLevel(context.serverRiskLevel)}</StatusPill> : null}
                <StatusPill>{formatEnvironment(approval.environment)}</StatusPill>
              </div>
            </div>
            <div className="detail-grid">
              <div className="grid">
                <p><strong>요청자:</strong> {approval.requesterId}</p>
                <p><strong>주체:</strong> {approval.subjectType}</p>
                <p><strong>요청 도구:</strong> {approval.requestedTools.length > 0 ? approval.requestedTools.join(", ") : "모든 도구"}</p>
                <p><strong>만료 요청:</strong> {formatDate(approval.requestedExpiresAt)}</p>
                {ticketUrl ? <p><a href={ticketUrl} target="_blank" rel="noreferrer">검토 티켓 열기</a></p> : null}
              </div>
              <div className="grid">
                <p><strong>서버 카테고리:</strong> {context?.serverCategory ?? "확인 불가"}</p>
                <p><strong>겹치는 기존 권한:</strong> {context ? `${context.grantOverlaps.length}개` : "확인 불가"}</p>
                {context?.requestedToolRisks.length ? (
                  <div className="actions">
                    {context.requestedToolRisks.map((tool) => (
                      <StatusPill tone={tool.riskLevel ? riskTone(tool.riskLevel) : "neutral"} key={tool.toolName}>
                        {tool.toolName}: {tool.riskLevel ? formatRiskLevel(tool.riskLevel) : "위험도 확인 불가"}
                      </StatusPill>
                    ))}
                  </div>
                ) : <p className="muted">도구 위험도 컨텍스트가 없습니다.</p>}
              </div>
            </div>
            <ApprovalActions approval={approval} context={context} />
          </Surface>
        );
      })}
    </div>
  );
}

function ApprovalActions({
  approval,
  context,
}: Readonly<{
  approval: ApiApproval;
  context: ApprovalDecisionContext | undefined;
}>) {
  const reviewCommentRequired = context?.reviewCommentRequired ?? false;

  return (
    <div className="decision-inputs">
      {reviewCommentRequired ? (
        <p className="muted">높음/심각 위험이 포함된 요청입니다. 승인 또는 거절 근거를 검토 의견에 남기세요.</p>
      ) : null}
      <div className="detail-grid">
      <form className="grid" action={approveApprovalAction}>
        <input type="hidden" name="approvalId" value={approval.id} />
        <div className="field">
          <label htmlFor={`allowedTools-${approval.id}`}>허용 도구</label>
          <input id={`allowedTools-${approval.id}`} name="allowedTools" defaultValue={approval.requestedTools.join(", ")} placeholder="쉼표로 구분한 도구" />
        </div>
        <div className="field">
          <label htmlFor={`expiresAt-${approval.id}`}>권한 만료</label>
          <input id={`expiresAt-${approval.id}`} name="expiresAt" defaultValue={approval.requestedExpiresAt ?? ""} placeholder="예: 2026-06-30T09:00:00Z" />
        </div>
        <div className="field">
          <label htmlFor={`approveComment-${approval.id}`}>검토 의견</label>
          <textarea id={`approveComment-${approval.id}`} name="reviewComment" required={reviewCommentRequired} placeholder={reviewCommentRequired ? "높음/심각 위험 승인 근거" : "승인 근거"} />
        </div>
        <button className="button" type="submit">승인하기</button>
      </form>
      <form className="grid" action={rejectApprovalAction}>
        <input type="hidden" name="approvalId" value={approval.id} />
        <div className="field">
          <label htmlFor={`rejectComment-${approval.id}`}>검토 의견</label>
          <textarea id={`rejectComment-${approval.id}`} name="reviewComment" required={reviewCommentRequired} placeholder={reviewCommentRequired ? "높음/심각 위험 거절 근거" : "거절 근거"} />
        </div>
        <button className="button button--danger" type="submit">거절하기</button>
      </form>
      </div>
    </div>
  );
}

function safeExternalUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}
