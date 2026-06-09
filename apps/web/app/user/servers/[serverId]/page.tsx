import Link from "next/link";
import { EmptyState, StatusPill, Surface } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../../../components/chrome";
import {
  enabledTone,
  formatDate,
  formatEnabled,
  formatEnvironment,
  formatHealthStatus,
  formatRiskLevel,
  formatTransport,
  healthTone,
  riskTone,
} from "../../../../components/format";
import { InstallGuide } from "../../../../components/install-guide";
import { ErrorState } from "../../../../components/states";
import { GrantTable, ToolTable } from "../../../../components/tables";
import { ToolTestLab } from "../../../../components/tool-test-lab";
import {
  buildAccessRequestHref as buildAccessStatusRequestHref,
  buildToolAccessStatusMap,
  evaluateAccessStatus,
  isHighOrCriticalRisk,
  type AccessStatus,
} from "../../../../lib/access-status";
import type { ApiMcpServer, ApiMcpTool } from "../../../../lib/api";
import { getServer, listApprovals, listGrants, listServerHealth, listTools } from "../../../../lib/api";
import { getCurrentSession } from "../../../../lib/auth/session";
import { loadResult } from "../../../../lib/result";
import { selectServerHealth } from "../../../servers/[serverId]/page-helpers";
import { buildToolTestOptions } from "../../../tools/page-helpers";
import {
  buildAccessRequestHref,
  buildRequestedTools,
  compactText,
  deriveServerSummary,
  deriveUseCases,
  formatInstallMethod,
  formatMarketCategory,
  formatTrustLevel,
  formatVisibility,
  trustTone,
  visibilityTone,
} from "./page-helpers";

type UserServerDetailPageProps = Readonly<{
  params: Promise<{ serverId: string }>;
}>;

export default async function UserServerDetailPage({ params }: UserServerDetailPageProps) {
  const { serverId } = await params;
  const session = await getCurrentSession();
  const [server, tools, health, grants, approvals] = await Promise.all([
    loadResult(getServer(serverId)),
    loadResult(listTools(serverId)),
    loadResult(listServerHealth()),
    loadResult(listGrants()),
    loadResult(listApprovals()),
  ]);

  if (!server.ok) {
    return <div className="page-stack"><PageHero eyebrow="서버 상세" title="서버를 사용할 수 없습니다." description="제어 플레인이 이 MCP 서버를 반환하지 못했습니다." /><ErrorState message={server.error} /><Link className="button" href="/user/catalog">카탈로그로 돌아가기</Link></div>;
  }

  const latestHealth = health.ok ? selectServerHealth(health.data.items, serverId) : undefined;
  const toolItems = tools.ok ? tools.data.items : [];
  const visibleGrants = grants.ok ? grants.data.items.filter((grant) => grant.serverId === serverId && grant.enabled && (grant.subjectId === session?.principal.userId || session?.principal.teamIds.includes(grant.subjectId) || session?.principal.teams.includes(grant.subjectId))) : [];
  const accessStatusByToolKey = buildToolAccessStatusMap(toolItems, {
    server: server.data,
    grants: grants.ok ? grants.data.items : undefined,
    approvals: approvals.ok ? approvals.data.items : undefined,
    session: session?.principal,
    health: latestHealth,
  });
  const serverAccessStatus = evaluateAccessStatus({
    server: server.data,
    grants: grants.ok ? grants.data.items : undefined,
    approvals: approvals.ok ? approvals.data.items : undefined,
    session: session?.principal,
    health: latestHealth,
  });
  const toolTestOptions = buildToolTestOptions([server.data], toolItems);
  const serverNameById = new Map([[server.data.id, server.data.displayName]]);
  const summary = deriveServerSummary(server.data);
  const useCaseSummary = deriveUseCases(server.data, toolItems);
  const requestedTools = buildRequestedTools(toolItems);
  const accessRequestHref = buildAccessRequestHref(server.data, requestedTools);
  const hasAccess = serverAccessStatus.status === "accessible";
  const tags = compactText(server.data.tags);
  const prerequisites = compactText(server.data.prerequisites);
  const securityNotes = compactText(server.data.securityNotes);
  const installMethods = server.data.installMethods ?? [];

  return (
    <div className="page-stack">
      <PageHero eyebrow={server.data.slug} title={server.data.displayName} description={summary} />
      <div className="actions">
        <StatusPill tone={trustTone(server.data.trustLevel)}>
          {formatTrustLevel(server.data.trustLevel)}
        </StatusPill>
        <StatusPill tone={riskTone(server.data.riskLevel)}>{formatRiskLevel(server.data.riskLevel)}</StatusPill>
        <StatusPill tone={enabledTone(server.data.enabled)}>{formatEnabled(server.data.enabled)}</StatusPill>
        {latestHealth ? <StatusPill tone={healthTone(latestHealth.status)}>{formatHealthStatus(latestHealth.status)}</StatusPill> : <StatusPill>상태 확인 불가</StatusPill>}
        <StatusPill tone={visibilityTone(server.data.visibility)}>{formatVisibility(server.data.visibility)}</StatusPill>
        <StatusPill tone={server.data.quarantined ? "danger" : "neutral"}>{server.data.quarantined ? "격리됨" : "격리 안 됨"}</StatusPill>
      </div>
      <div className="actions">
        {hasAccess ? <Link className="button" href={`/user/client-config?serverId=${encodeURIComponent(server.data.id)}`}>클라이언트 설정 생성</Link> : <Link className="button" href={accessRequestHref}>접근 요청</Link>}
        <Link className="button button--ghost" href="/user/catalog">Market으로 돌아가기</Link>
      </div>
      <div className="detail-grid">
        <Surface>
          <SectionHeader title="연결 요약" description="사용 전에 확인할 목적, 환경, 설치 정보를 먼저 보여줍니다." />
          <div className="grid">
            <p><strong>카테고리:</strong> {formatMarketCategory(server.data.category)}</p>
            <p><strong>태그:</strong> {tags.length > 0 ? tags.join(", ") : "태그 없음"}</p>
            <p><strong>환경:</strong> {formatEnvironment(server.data.environment)}</p>
            <p><strong>전송 방식:</strong> {formatTransport(server.data.transport)}</p>
            <p><strong>설치 방식:</strong> {installMethods.length > 0 ? installMethods.map(formatInstallMethod).join(", ") : "Gateway 생성기"}</p>
            <details className="schema-viewer">
              <summary>운영 세부정보 보기</summary>
              <div className="grid">
                <p><strong>서버 ID:</strong> {server.data.id}</p>
                <p><strong>소유 팀:</strong> {server.data.ownerTeamId}</p>
                <p><strong>생성:</strong> {formatDate(server.data.createdAt)}</p>
                <p><strong>업데이트:</strong> {formatDate(server.data.updatedAt)}</p>
              </div>
            </details>
          </div>
        </Surface>
        <Surface className="panel--accent">
          <SectionHeader title="접근 상태" description="현재 세션의 grant, 승인 대기, 서버 운영 상태를 함께 해석합니다." />
          <div className="grid">
            <div className="actions">
              <StatusPill tone={riskTone(server.data.riskLevel)}>{formatRiskLevel(server.data.riskLevel)}</StatusPill>
              <StatusPill tone={enabledTone(server.data.enabled)}>{formatEnabled(server.data.enabled)}</StatusPill>
              {latestHealth ? <StatusPill tone={healthTone(latestHealth.status)}>{formatHealthStatus(latestHealth.status)}</StatusPill> : <StatusPill>상태 확인 불가</StatusPill>}
              <StatusPill tone={serverAccessStatus.tone}>{serverAccessStatus.label}</StatusPill>
            </div>
            <p><strong>내 접근:</strong> {serverAccessStatus.label}</p>
            <p><strong>요청 대상 도구:</strong> {requestedTools.join(", ")}</p>
            {latestHealth ? <p className="muted">최근 상태 확인: {formatDate(latestHealth.checkedAt)}{latestHealth.errorMessage ? ` · ${latestHealth.errorMessage}` : ""}</p> : <p className="muted">이 서버에 대한 상태 행이 반환되지 않았습니다.</p>}
            <p className="muted">{serverAccessStatus.actionHint}</p>
            {serverAccessStatus.status === "request_required" || serverAccessStatus.status === "unknown" ? (
              <Link className="button" href={buildAccessStatusRequestHref({ serverId: server.data.id, tools: requestedTools, environment: server.data.environment, reason: `${server.data.displayName} 서버 접근이 필요합니다.` })}>
                서버 접근 요청
              </Link>
            ) : null}
          </div>
        </Surface>
      </div>
      <section>
        <SectionHeader title="무엇을 할 수 있나" description={useCaseSummary.source === "metadata" ? "카탈로그 메타데이터에 등록된 사용 사례입니다." : "등록된 사용 사례가 없으면 도구 설명에서 기능을 요약합니다."} />
        {useCaseSummary.items.length > 0 ? (
          <Surface>
            <ul>
              {useCaseSummary.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </Surface>
        ) : (
          <EmptyState title="사용 사례 메타데이터 없음" description="제어 플레인 서버 설명과 도구 설명이 비어 있어 기능 요약을 만들 수 없습니다." />
        )}
      </section>
      <section>
        <SectionHeader title="도구" description="도구별 활성 상태, 위험도, 입력 스키마, 현재 사용자 관점의 접근 상태입니다." />
        {tools.ok && toolItems.length > 0 ? <ToolTable tools={toolItems} accessStatusByToolKey={accessStatusByToolKey} showSchema showAccess accessActionSlot={(tool, status) => <UserToolAccessAction server={server.data} tool={tool} status={status} />} audience="user" /> : tools.ok ? <EmptyState title="발견된 도구 없음" description="서버는 존재하지만 제어 플레인이 도구를 반환하지 않았습니다." /> : <ErrorState message={tools.error} />}
      </section>
      {tools.ok && toolItems.length > 0 ? (
        <section>
          <SectionHeader title="정책 드라이런" description="기존 /api/policy/test-call을 사용해 dry-run 정책 결정, 스텝업 여부, 마스킹된 payload preview만 확인합니다." />
          <ToolTestLab options={toolTestOptions} />
        </section>
      ) : null}
      <section>
        <SectionHeader title="접근 및 승인" description="이 서버와 현재 세션 식별자에 맞는 grant만 표시하고, 없으면 prefill된 요청으로 이동합니다." action={<Link className="button button--ghost" href={accessRequestHref}>{hasAccess ? "추가 도구 요청" : "접근 요청"}</Link>} />
        {grants.ok && visibleGrants.length > 0 ? (
          <div className="grid">
            <Surface>
              <p><strong>허용 도구 요약:</strong> {formatAllowedTools(visibleGrants)}</p>
              <p className="muted">권한이 있는 도구만 Gateway 정책에서 허용됩니다. 새 도구나 다른 환경은 별도 승인이 필요합니다.</p>
            </Surface>
            <GrantTable grants={visibleGrants} serverNameById={serverNameById} audience="user" />
          </div>
        ) : grants.ok ? <EmptyState title="일치하는 권한 없음" description="이 도구 중 하나를 사용해야 한다면 접근을 요청하세요." action={<Link className="button" href={accessRequestHref}>접근 요청 열기</Link>} /> : <ErrorState message={grants.error} />}
      </section>
      <InstallGuide server={server.data} hasAccess={hasAccess} accessRequestHref={accessRequestHref} />
      <section>
        <SectionHeader title="보안/운영 참고" description="연결 전 사전 조건, 토큰 처리, 환경/전송 특성을 확인합니다." />
        <div className="detail-grid">
          <ReferenceList title="사전 조건" items={prerequisites} emptyText="등록된 사전 조건이 없습니다. 필요한 권한은 접근 요청 승인으로 관리됩니다." />
          <ReferenceList title="보안 노트" items={securityNotes.length > 0 ? securityNotes : ["Gateway 정책, 권한 확인, redaction이 upstream 호출 전에 적용됩니다.", "토큰과 시크릿은 클라이언트 환경 변수로 주입하고 설정 JSON에 원문 값을 저장하지 않습니다."]} emptyText="" />
        </div>
      </section>
      {!approvals.ok ? <ErrorState title="승인 대기 상태 사용 불가" message={approvals.error} /> : null}
    </div>
  );
}

function UserToolAccessAction({
  server,
  tool,
  status,
}: Readonly<{
  server: ApiMcpServer;
  tool: ApiMcpTool;
  status: AccessStatus | undefined;
}>) {
  if (!status) {
    return null;
  }

  if (status.status === "accessible") {
    return <Link className="button button--ghost" href="/user/client-config">클라이언트 설정으로 이동</Link>;
  }

  if (status.status === "pending_approval") {
    return <p className="muted">이미 같은 서버/도구 승인 요청이 대기 중입니다.</p>;
  }

  if (status.status === "disabled" || status.status === "quarantined") {
    return <p className="muted">관리자 조치 전에는 새 요청을 만들지 않습니다.</p>;
  }

  return (
    <div className="grid">
      {isHighOrCriticalRisk(tool.riskLevel) ? (
        <p className="muted">높음/심각 위험 도구입니다. 요청 사유에 업무 범위, 기간, 승인 근거를 포함하세요.</p>
      ) : null}
      <Link className="button" href={buildAccessStatusRequestHref({ serverId: server.id, toolName: tool.name, environment: server.environment, reason: `${server.displayName} / ${tool.name} 도구 접근이 필요합니다.` })}>
        접근 요청
      </Link>
    </div>
  );
}

function ReferenceList({ title, items, emptyText }: Readonly<{ title: string; items: string[]; emptyText: string }>) {
  return (
    <Surface>
      <SectionHeader title={title} />
      {items.length > 0 ? (
        <ul>
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="muted">{emptyText}</p>
      )}
    </Surface>
  );
}

function formatAllowedTools(grants: ReadonlyArray<{ allowedTools: string[] }>) {
  const tools = Array.from(new Set(grants.flatMap((grant) => grant.allowedTools)));
  return tools.length > 0 ? tools.join(", ") : "도구 범위 없음";
}
