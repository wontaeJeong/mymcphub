import Link from "next/link";
import { EmptyState, Surface } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { GrantTable, ServerTable } from "../../components/tables";
import { getCurrentSession } from "../../lib/auth/session";
import { listGrants, listServers } from "../../lib/api";
import { loadResult } from "../../lib/result";

export default async function UserHomePage() {
  const session = await getCurrentSession();
  const [servers, grants] = await Promise.all([loadResult(listServers()), loadResult(listGrants())]);
  const serverItems = servers.ok ? servers.data.items.filter((server) => server.enabled) : [];
  const userGrants = grants.ok ? grants.data.items.filter((grant) => grant.enabled && (grant.subjectId === session?.principal.userId || session?.principal.teamIds.includes(grant.subjectId) || session?.principal.teams.includes(grant.subjectId))) : [];
  const serverNameById = new Map(serverItems.map((server) => [server.id, server.displayName]));

  return (
    <div className="page-stack">
      <PageHero eyebrow="사용자 워크스페이스" title="실제로 사용할 수 있는 도구를 찾으세요." description="관리자 전용 작업을 노출하지 않고 MCP 서버를 탐색하고, 필요한 접근을 요청하고, 클라이언트 설정을 생성합니다." />
      <div className="card-grid">
        <Surface><SectionHeader title="활성 서버" /><p>{serverItems.length}</p></Surface>
        <Surface><SectionHeader title="표시 가능한 권한" /><p>{userGrants.length}</p></Surface>
        <Surface><SectionHeader title="관리자 접근" /><p>{session?.principal.isPlatformAdmin ? "사용 가능" : "부여되지 않음"}</p></Surface>
      </div>
      {!servers.ok ? <ErrorState message={servers.error} /> : null}
      <section>
        <SectionHeader title="사용자 작업" description="셀프서비스 페이지는 관리자 콘솔과 분리되어 있습니다." />
        <div className="card-grid">
          <UserLink href="/user/catalog" title="카탈로그 탐색" description="허브가 노출하는 서버와 도구를 확인합니다." />
          <UserLink href="/user/access" title="접근 요청" description="승인 요청을 제출하고 현재 권한을 검토합니다." />
          <UserLink href="/user/client-config" title="클라이언트 설정" description="활성 서버에 대한 MCP 클라이언트 snippet을 생성합니다." />
        </div>
      </section>
      <section>
        <SectionHeader title="활성 카탈로그 미리보기" description="서버 링크는 사용자 route 트리에 유지됩니다." action={<Link className="button" href="/user/catalog">카탈로그 열기</Link>} />
        {servers.ok && serverItems.length > 0 ? <ServerTable servers={serverItems.slice(0, 5)} serverBasePath="/user/servers" /> : servers.ok ? <EmptyState title="활성 서버 없음" description="제어 플레인이 활성 서버를 반환하지 않았습니다." /> : null}
      </section>
      <section>
        <SectionHeader title="내 표시 권한" description="Web 세션의 현재 사용자 또는 팀 식별자와 일치하는 권한만 표시합니다." action={<Link className="button" href="/user/access">접근 권한 열기</Link>} />
        {grants.ok && userGrants.length > 0 ? <GrantTable grants={userGrants} serverNameById={serverNameById} /> : grants.ok ? <EmptyState title="표시 가능한 권한 없음" description="필요한 도구가 없다면 접근을 요청하세요." /> : <ErrorState message={grants.error} />}
      </section>
    </div>
  );
}

function UserLink({ href, title, description }: Readonly<{ href: string; title: string; description: string }>) {
  return <Link className="panel" href={href}><h2>{title}</h2><p>{description}</p></Link>;
}
