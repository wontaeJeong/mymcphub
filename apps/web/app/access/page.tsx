import { EmptyState } from "@mcp-hub/ui";

import { createApprovalAction, createGrantAction, revokeGrantAction } from "../actions";
import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { GrantTable } from "../../components/tables";
import type { ApiGrant } from "../../lib/api";
import { listGrants, listServers } from "../../lib/api";
import { loadResult } from "../../lib/result";

export default async function AccessPage() {
  const serversPromise = loadResult(listServers());
  const grantsPromise = loadResult(listGrants());
  const [servers, grants] = await Promise.all([serversPromise, grantsPromise]);
  const serverItems = servers.ok ? servers.data.items : [];
  const serverNameById = new Map(serverItems.map((server) => [server.id, server.displayName]));

  return (
    <div className="page-stack">
      <PageHero eyebrow="접근 요청 및 권한" title="추측 없는 권한 흐름." description="실제 제어 플레인 엔드포인트로 현재 권한을 검토하고, 승인 요청 제출, 권한 생성, 권한 회수를 수행합니다." />
      <section>
        <SectionHeader title="현재 권한" description="/api/grants 데이터이며, 가능한 경우 서버 카탈로그와 로컬에서 결합합니다." />
        {grants.ok && grants.data.items.length > 0 ? <GrantTable grants={grants.data.items} serverNameById={serverNameById} actionSlot={GrantControls} /> : grants.ok ? <EmptyState title="권한 없음" description="제어 플레인이 권한을 반환하지 않았습니다." /> : <ErrorState message={grants.error} />}
      </section>
      <div className="form-grid">
        <form className="form-card" action={createApprovalAction}>
          <h2>접근 승인 요청</h2>
          <p>주체, 도구, 환경, 티켓, 만료, 사유를 정식 필드로 /api/approvals에 보내 승인 대기 요청을 생성합니다.</p>
          {servers.ok && serverItems.length > 0 ? (
            <>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="approvalSubjectType">주체 유형</label>
                  <select id="approvalSubjectType" name="subjectType" required>
                    <option value="team">팀</option>
                    <option value="user">사용자</option>
                    <option value="service_account">서비스 계정</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="approvalEnvironment">환경</label>
                  <select id="approvalEnvironment" name="environment" required>
                    <option value="dev">개발</option>
                    <option value="stg">스테이징</option>
                    <option value="prod">운영</option>
                    <option value="shared">공용</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="approvalSubjectId">주체 ID</label>
                <input id="approvalSubjectId" name="subjectId" required placeholder="사용자, 팀, 서비스 계정 UUID" />
              </div>
              <div className="field">
                <label htmlFor="approvalServerId">서버</label>
                <select id="approvalServerId" name="serverId" required>
                  {serverItems.map((server) => <option value={server.id} key={server.id}>{server.displayName}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="approvalProjectId">프로젝트 ID</label>
                <input id="approvalProjectId" name="projectId" required placeholder="프로젝트 레코드의 UUID" />
              </div>
              <div className="field">
                <label htmlFor="approvalRequestedTools">요청 도구</label>
                <input id="approvalRequestedTools" name="requestedTools" required placeholder="단일 도구 또는 쉼표로 구분한 도구" />
              </div>
              <div className="field">
                <label htmlFor="requestedAction">요청 작업</label>
                <input id="requestedAction" name="requestedAction" required defaultValue="grant_access" />
              </div>
              <div className="field">
                <label htmlFor="approvalTicketUrl">티켓 URL</label>
                <input id="approvalTicketUrl" name="ticketUrl" type="url" placeholder="선택 사항인 승인 티켓" />
              </div>
              <div className="field">
                <label htmlFor="approvalRequestedExpiresAt">요청 만료</label>
                <input id="approvalRequestedExpiresAt" name="requestedExpiresAt" placeholder="선택 사항인 ISO 시각" />
              </div>
              <div className="field">
                <label htmlFor="approvalReason">사유</label>
                <textarea id="approvalReason" name="reason" required placeholder="업무상 필요 사유" />
              </div>
              <div className="form-actions"><button className="button" type="submit">승인 요청 제출</button></div>
            </>
          ) : servers.ok ? <EmptyState title="사용 가능한 서버 없음" description="승인 요청에는 카탈로그의 서버가 필요합니다." /> : <ErrorState message={servers.error} />}
        </form>
        <form className="form-card" action={createGrantAction}>
          <h2>권한 생성</h2>
          <p>이미 승인 권한이 있을 때 /api/grants로 접근 권한을 생성합니다.</p>
          {servers.ok && serverItems.length > 0 ? (
            <>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="subjectType">주체 유형</label>
                  <select id="subjectType" name="subjectType" required>
                    <option value="team">팀</option>
                    <option value="user">사용자</option>
                    <option value="service_account">서비스 계정</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="environment">환경</label>
                  <select id="environment" name="environment" required>
                    <option value="dev">개발</option>
                    <option value="stg">스테이징</option>
                    <option value="prod">운영</option>
                    <option value="shared">공용</option>
                  </select>
                </div>
              </div>
              <div className="field"><label htmlFor="subjectId">주체 ID</label><input id="subjectId" name="subjectId" required /></div>
              <div className="field"><label htmlFor="grantProjectId">프로젝트 ID</label><input id="grantProjectId" name="projectId" required placeholder="프로젝트 레코드의 UUID" /></div>
              <div className="field">
                <label htmlFor="grantServerId">서버</label>
                <select id="grantServerId" name="serverId" required>
                  {serverItems.map((server) => <option value={server.id} key={server.id}>{server.displayName}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor="allowedTools">허용 도구</label><input id="allowedTools" name="allowedTools" required placeholder="쉼표로 구분한 도구 이름" /></div>
              <div className="field"><label htmlFor="ticketUrl">티켓 URL</label><input id="ticketUrl" name="ticketUrl" type="url" placeholder="선택 사항인 승인 티켓" /></div>
              <div className="field"><label htmlFor="expiresAt">만료 시각</label><input id="expiresAt" name="expiresAt" placeholder="선택 사항인 ISO 시각" /></div>
              <div className="field"><label htmlFor="grantReason">사유</label><textarea id="grantReason" name="reason" required /></div>
              <div className="form-actions"><button className="button" type="submit">권한 생성</button></div>
            </>
          ) : servers.ok ? <EmptyState title="사용 가능한 서버 없음" description="권한 생성에는 카탈로그의 서버가 필요합니다." /> : <ErrorState message={servers.error} />}
        </form>
      </div>
    </div>
  );
}

function GrantControls(grant: ApiGrant) {
  return (
    <form action={revokeGrantAction}>
      <input type="hidden" name="grantId" value={grant.id} />
      <button className="button button--danger" type="submit" disabled={!grant.enabled}>{grant.enabled ? "권한 회수" : "회수됨"}</button>
    </form>
  );
}
