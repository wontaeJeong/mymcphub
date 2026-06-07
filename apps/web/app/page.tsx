import Link from "next/link";
import { EmptyState, Surface, StatusPill } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../components/chrome";
import { DashboardSummary } from "../components/dashboard-summary";
import { formatDate, formatHealthStatus, healthTone } from "../components/format";
import { ErrorState } from "../components/states";
import { ApprovalTable, AuditTable, HealthTable, ServerTable } from "../components/tables";
import { getMe, listApprovals, listAuditEvents, listServerHealth, listServers, listToolCallEvents, listTools } from "../lib/api";
import { loadResult } from "../lib/result";

export default async function Page() {
  const mePromise = loadResult(getMe());
  const serversPromise = loadResult(listServers());
  const approvalsPromise = loadResult(listApprovals());
  const healthPromise = loadResult(listServerHealth());
  const auditPromise = loadResult(listAuditEvents({ limit: 25 }));
  const toolCallsPromise = loadResult(listToolCallEvents());
  const [me, servers, approvals, health, audit, toolCalls] = await Promise.all([
    mePromise,
    serversPromise,
    approvalsPromise,
    healthPromise,
    auditPromise,
    toolCallsPromise
  ]);

  const serverItems = servers.ok ? servers.data.items : [];
  const approvalItems = approvals.ok ? approvals.data.items : [];
  const healthItems = health.ok ? health.data.items : [];
  const auditItems = audit.ok ? audit.data.items : [];
  const toolCallItems = toolCalls.ok ? toolCalls.data.items : [];
  const toolResults = await Promise.all(serverItems.map(async (server) => loadResult(listTools(server.id))));
  const toolItems = toolResults.flatMap((result) => result.ok ? result.data.items : []);
  const unhealthyServers = healthItems.filter((check) => check.status !== "healthy").length;
  const failedToolCalls = toolCallItems.filter((event) => !isSuccessfulToolCallStatus(event.status)).length;
  const serverNameById = new Map(serverItems.map((server) => [server.id, server.displayName]));

  return (
    <div className="page-stack">
      <PageHero
        eyebrow="운영 대시보드"
        title="MCP 거버넌스를 위한 실시간 콘솔."
        description="Web UI는 제어 플레인 API에 연결하고, 데이터가 없거나 서비스가 오프라인이면 빈 상태 또는 오류 상태를 표시합니다."
      />

      {servers.ok || audit.ok || toolCalls.ok || health.ok ? (
        <DashboardSummary
          registeredServers={serverItems.length}
          enabledServers={serverItems.filter((server) => server.enabled).length}
          disabledServers={serverItems.filter((server) => !server.enabled).length}
          highCriticalTools={toolItems.filter((tool) => tool.riskLevel === "high" || tool.riskLevel === "critical").length}
          recentDeniedCalls={auditItems.filter((event) => event.policyDecision === "deny").length}
          recentFailedCalls={failedToolCalls + unhealthyServers}
          activeSessionStatus="사용 불가"
          activeSessionDetail="제어 플레인 세션 엔드포인트가 없습니다"
        />
      ) : (
        <ErrorState message={servers.ok ? "제어 플레인 지표를 사용할 수 없습니다." : servers.error} />
      )}

      <div className="detail-grid">
        <Surface className="panel--accent">
          <SectionHeader eyebrow="신원" title="현재 운영자" description="/api/me에서 반환한 인증 컨텍스트입니다." />
          {me.ok ? (
            <div className="grid">
              <p><strong>{me.data.auth.displayName}</strong></p>
              <p className="muted">{me.data.auth.email}</p>
              <div className="actions">
                {me.data.auth.roles.map((role) => <StatusPill tone="info" key={role}>{role}</StatusPill>)}
              </div>
            </div>
          ) : (
            <ErrorState message={me.error} />
          )}
        </Surface>
        <Surface>
          <SectionHeader eyebrow="상태" title="최신 신호" description="가장 최근 서버 상태 행입니다." />
          {health.ok && healthItems.length > 0 ? (
            <div className="grid">
              {healthItems.slice(0, 3).map((check) => (
                <p key={check.id}>
                  <StatusPill tone={healthTone(check.status)}>{formatHealthStatus(check.status)}</StatusPill>{" "}
                  {serverNameById.get(check.serverId) ?? check.serverId} · {formatDate(check.checkedAt)}
                </p>
              ))}
            </div>
          ) : health.ok ? (
            <EmptyState title="상태 확인 없음" description="워커가 서버 상태를 기록하면 상태 행이 표시됩니다." />
          ) : (
            <ErrorState message={health.error} />
          )}
        </Surface>
      </div>

      <section>
        <SectionHeader title="서버 카탈로그" description="등록된 MCP 서버를 빠르게 확인합니다." action={<Link className="button" href="/catalog">카탈로그 열기</Link>} />
        {servers.ok && serverItems.length > 0 ? <ServerTable servers={serverItems.slice(0, 6)} /> : servers.ok ? <EmptyState title="서버 없음" description="제어 플레인이 빈 서버 카탈로그를 반환했습니다." /> : <ErrorState message={servers.error} />}
      </section>

      <section>
        <SectionHeader title="승인 대기열" description="검토를 기다리는 접근 요청입니다." action={<Link className="button" href="/approvals">대기열 검토</Link>} />
        {approvals.ok && approvalItems.length > 0 ? <ApprovalTable approvals={approvalItems.slice(0, 5)} /> : approvals.ok ? <EmptyState title="승인 요청 없음" description="대기열에 승인 요청이 없습니다." /> : <ErrorState message={approvals.error} />}
      </section>

      <section>
        <SectionHeader title="감사 흐름" description="최근 정책 및 관리자 감사 이벤트입니다." action={<Link className="button" href="/audit">감사 로그 열기</Link>} />
        {audit.ok && auditItems.length > 0 ? <AuditTable events={auditItems.slice(0, 8)} /> : audit.ok ? <EmptyState title="감사 이벤트 없음" description="API가 감사 이벤트를 반환하지 않았습니다." /> : <ErrorState message={audit.error} />}
      </section>

      <section>
        <SectionHeader title="상태 운영" description="서버 상태 확인별 상태입니다." action={<Link className="button" href="/operations">운영 상태 열기</Link>} />
        {health.ok && healthItems.length > 0 ? <HealthTable checks={healthItems} serverNameById={serverNameById} /> : health.ok ? <EmptyState title="상태 행 없음" description="제어 플레인이 서버 상태 확인을 반환하지 않았습니다." /> : <ErrorState message={health.error} />}
      </section>
    </div>
  );
}

function isSuccessfulToolCallStatus(status: string) {
  const normalized = status.toLowerCase();
  return normalized === "ok" || normalized === "success" || normalized === "succeeded";
}
