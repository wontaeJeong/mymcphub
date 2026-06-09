import Link from "next/link";
import { EmptyState, MetricCard } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { GrantTable, ServerTable } from "../../components/tables";
import { getCurrentSession } from "../../lib/auth/session";
import { listGrants, listServerHealth, listServers } from "../../lib/api";
import { loadResult } from "../../lib/result";
import { buildMarketSummary, buildServerAccessMap, isDefaultMarketVisible } from "../catalog/page-helpers";

export default async function UserHomePage() {
  const session = await getCurrentSession();
  const [servers, grants, health] = await Promise.all([loadResult(listServers()), loadResult(listGrants()), loadResult(listServerHealth())]);
  const allServers = servers.ok ? servers.data.items : [];
  const healthByServerId = new Map((health.ok ? health.data.items : []).map((check) => [check.serverId, check]));
  const accessByServerId = grants.ok ? buildServerAccessMap(allServers, grants.data.items, session?.principal) : new Map<string, boolean>();
  const marketSummary = buildMarketSummary(allServers, health.ok ? healthByServerId : undefined, accessByServerId);
  const serverItems = allServers.filter((server) => server.enabled && isDefaultMarketVisible(server));
  const userGrants = grants.ok ? grants.data.items.filter((grant) => grant.enabled && (grant.subjectId === session?.principal.userId || session?.principal.teamIds.includes(grant.subjectId) || session?.principal.teams.includes(grant.subjectId))) : [];
  const serverNameById = new Map(serverItems.map((server) => [server.id, server.displayName]));

  return (
    <div className="page-stack">
      <PageHero eyebrow="사용자 워크스페이스" title="MCP Market에서 바로 시작하세요." description="내부에 게시된 MCP 서버를 탐색하고, 접근이 필요한 항목을 요청한 뒤, 클라이언트 설정 생성으로 연결합니다." />
      <div className="metric-grid">
        <MetricCard label="게시/활성 서버" value={marketSummary.publishedActiveServers} detail="Market 기본 노출 대상" tone="info" />
        <MetricCard label="내 접근 가능" value={marketSummary.accessibleServers} detail={grants.ok ? "현재 세션 권한 기준" : "권한 API 확인 불가"} tone={marketSummary.accessibleServers > 0 ? "success" : "neutral"} />
        <MetricCard label="접근 요청 필요" value={marketSummary.requestRequiredServers} detail="활성·게시 서버 중 권한 없음" tone={marketSummary.requestRequiredServers > 0 ? "warning" : "success"} />
        <MetricCard label="상태 이상" value={marketSummary.statusIssueServers} detail={health.ok ? "비정상·저하·확인 불가" : "상태 API 확인 불가"} tone={marketSummary.statusIssueServers > 0 ? "danger" : "success"} />
      </div>
      {!servers.ok ? <ErrorState message={servers.error} /> : null}
      {!health.ok ? <ErrorState title="상태 정보 사용 불가" message={health.error} /> : null}
      <section>
        <SectionHeader title="Market 작업" description="셀프서비스 페이지는 관리자 콘솔과 분리되어 있습니다." />
        <div className="card-grid">
          <UserLink href="/user/catalog" title="MCP Market 열기" description="카테고리, 태그, 신뢰 수준, 접근 상태로 서버를 탐색합니다." />
          <UserLink href="/user/access" title="내 권한 보기" description="현재 접근 권한을 확인하고 필요한 서버 접근을 요청합니다." />
          <UserLink href="/user/client-config" title="클라이언트 설정 생성" description="접근 가능한 서버를 MCP 클라이언트 snippet으로 연결합니다." />
        </div>
      </section>
      <section>
        <SectionHeader title="MCP Market 미리보기" description="게시·내부 공개되고 활성화된 서버만 우선 노출합니다." action={<Link className="button" href="/user/catalog">MCP Market 열기</Link>} />
        {servers.ok && serverItems.length > 0 ? <ServerTable servers={serverItems.slice(0, 5)} healthByServerId={healthByServerId} serverBasePath="/user/servers" /> : servers.ok ? <EmptyState title="활성 Market 서버 없음" description="제어 플레인이 기본 노출 대상 서버를 반환하지 않았습니다." /> : null}
      </section>
      <section>
        <SectionHeader title="내 표시 권한" description="Web 세션의 현재 사용자 또는 팀 식별자와 일치하는 권한만 표시합니다." action={<Link className="button" href="/user/access">내 권한 보기</Link>} />
        {grants.ok && userGrants.length > 0 ? <GrantTable grants={userGrants} serverNameById={serverNameById} audience="user" /> : grants.ok ? <EmptyState title="표시 가능한 권한 없음" description="필요한 도구가 없다면 접근을 요청하세요." /> : <ErrorState message={grants.error} />}
      </section>
    </div>
  );
}

function UserLink({ href, title, description }: Readonly<{ href: string; title: string; description: string }>) {
  return <Link className="panel" href={href}><h2>{title}</h2><p>{description}</p></Link>;
}
