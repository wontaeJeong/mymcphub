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
      <PageHero eyebrow="서버 찾기" title="서버를 찾고 접근을 요청하세요." description="필요한 서버를 찾고 접근 권한과 운영 상태를 확인합니다." />
      <div className="metric-grid">
        <MetricCard label="연결 가능한 서버" value={marketSummary.publishedActiveServers} detail="사용 가능한 목록" tone="info" />
        <MetricCard label="내 권한" value={marketSummary.accessibleServers} detail={grants.ok ? "현재 계정 기준" : "권한 정보 없음"} tone={marketSummary.accessibleServers > 0 ? "success" : "neutral"} />
        <MetricCard label="접근 요청 필요" value={marketSummary.requestRequiredServers} detail="활성·게시 서버 중 권한 없음" tone={marketSummary.requestRequiredServers > 0 ? "warning" : "success"} />
        <MetricCard label="상태 이상" value={marketSummary.statusIssueServers} detail={health.ok ? "조치 필요" : "상태 정보 없음"} tone={marketSummary.statusIssueServers > 0 ? "danger" : "success"} />
      </div>
      {!servers.ok ? <ErrorState message={servers.error} /> : null}
      {!health.ok ? <ErrorState title="상태 정보 사용 불가" message={health.error} /> : null}
      <section>
        <SectionHeader title="최근 서버" description="연결 가능한 서버를 먼저 확인하세요." />
        {servers.ok && serverItems.length > 0 ? <ServerTable servers={serverItems.slice(0, 5)} healthByServerId={healthByServerId} serverBasePath="/user/servers" /> : servers.ok ? <EmptyState title="등록된 서버가 없습니다" description="관리자에게 서버 등록을 요청하세요." /> : null}
      </section>
      <section>
        <SectionHeader title="내 권한" description="현재 사용할 수 있는 서버와 도구입니다." />
        {grants.ok && userGrants.length > 0 ? <GrantTable grants={userGrants} serverNameById={serverNameById} audience="user" /> : grants.ok ? <EmptyState title="권한이 없습니다" description="필요한 서버가 있다면 접근을 요청하세요." /> : <ErrorState message={grants.error} />}
      </section>
    </div>
  );
}
