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
import { ErrorState } from "../../../../components/states";
import { GrantTable, ToolTable } from "../../../../components/tables";
import { getCurrentSession } from "../../../../lib/auth/session";
import { getServer, listGrants, listServerHealth, listTools } from "../../../../lib/api";
import { loadResult } from "../../../../lib/result";
import { buildGrantStatus } from "../../../tools/page-helpers";
import { selectServerHealth } from "../../../servers/[serverId]/page-helpers";

type UserServerDetailPageProps = Readonly<{
  params: Promise<{ serverId: string }>;
}>;

export default async function UserServerDetailPage({ params }: UserServerDetailPageProps) {
  const { serverId } = await params;
  const session = await getCurrentSession();
  const [server, tools, health, grants] = await Promise.all([
    loadResult(getServer(serverId)),
    loadResult(listTools(serverId)),
    loadResult(listServerHealth()),
    loadResult(listGrants()),
  ]);

  if (!server.ok) {
    return <div className="page-stack"><PageHero eyebrow="서버 상세" title="서버를 사용할 수 없습니다." description="제어 플레인이 이 MCP 서버를 반환하지 못했습니다." /><ErrorState message={server.error} /><Link className="button" href="/user/catalog">카탈로그로 돌아가기</Link></div>;
  }

  const latestHealth = health.ok ? selectServerHealth(health.data.items, serverId) : undefined;
  const toolItems = tools.ok ? tools.data.items : [];
  const visibleGrants = grants.ok ? grants.data.items.filter((grant) => grant.serverId === serverId && grant.enabled && (grant.subjectId === session?.principal.userId || session?.principal.teamIds.includes(grant.subjectId) || session?.principal.teams.includes(grant.subjectId))) : [];
  const grantStatusByToolKey = buildGrantStatus(toolItems, visibleGrants);
  const serverNameById = new Map([[server.data.id, server.data.displayName]]);

  return (
    <div className="page-stack">
      <PageHero eyebrow={server.data.slug} title={server.data.displayName} description={server.data.description ?? "공개된 서버 설명이 없습니다."} />
      <div className="detail-grid">
        <Surface>
          <SectionHeader title="서버 프로필" description="이 MCP 서버의 읽기 전용 제어 플레인 메타데이터입니다." />
          <div className="grid">
            <p><strong>서버 ID:</strong> {server.data.id}</p>
            <p><strong>소유 팀:</strong> {server.data.ownerTeamId}</p>
            <p><strong>환경:</strong> {formatEnvironment(server.data.environment)}</p>
            <p><strong>전송 방식:</strong> {formatTransport(server.data.transport)}</p>
            <p><strong>생성:</strong> {formatDate(server.data.createdAt)}</p>
            <p><strong>업데이트:</strong> {formatDate(server.data.updatedAt)}</p>
          </div>
        </Surface>
        <Surface className="panel--accent">
          <SectionHeader title="접근 상태" description="사용자 페이지는 상태만 표시합니다. 관리자 제어는 /admin 아래에 있습니다." />
          <div className="actions">
            <StatusPill tone={riskTone(server.data.riskLevel)}>{formatRiskLevel(server.data.riskLevel)}</StatusPill>
            <StatusPill tone={enabledTone(server.data.enabled)}>{formatEnabled(server.data.enabled)}</StatusPill>
            {latestHealth ? <StatusPill tone={healthTone(latestHealth.status)}>{formatHealthStatus(latestHealth.status)}</StatusPill> : <StatusPill>상태 확인 불가</StatusPill>}
          </div>
        </Surface>
      </div>
      <section>
        <SectionHeader title="도구" description="현재 사용자 또는 팀 권한에 보이는 도구 스키마와 권한 상태입니다." />
        {tools.ok && toolItems.length > 0 ? <ToolTable tools={toolItems} grantStatusByToolKey={grantStatusByToolKey} showSchema showAccess /> : tools.ok ? <EmptyState title="발견된 도구 없음" description="서버는 존재하지만 제어 플레인이 도구를 반환하지 않았습니다." /> : <ErrorState message={tools.error} />}
      </section>
      <section>
        <SectionHeader title="이 서버의 내 권한" description="이 서버와 현재 세션 식별자에 맞는 권한만 표시합니다." />
        {grants.ok && visibleGrants.length > 0 ? <GrantTable grants={visibleGrants} serverNameById={serverNameById} /> : grants.ok ? <EmptyState title="일치하는 권한 없음" description="이 도구 중 하나를 사용해야 한다면 접근을 요청하세요." /> : <ErrorState message={grants.error} />}
      </section>
    </div>
  );
}
