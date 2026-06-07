import Link from "next/link";
import { EmptyState, Surface } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { formatSubjectType } from "../../components/format";
import { ErrorState } from "../../components/states";
import { ToolTable } from "../../components/tables";
import type { ApiMcpTool } from "../../lib/api";
import { listGrants, listServers, listTools } from "../../lib/api";
import { loadResult } from "../../lib/result";

export default async function ToolsPage() {
  const serversPromise = loadResult(listServers());
  const grantsPromise = loadResult(listGrants());
  const [servers, grants] = await Promise.all([serversPromise, grantsPromise]);
  if (!servers.ok) {
    return (
      <div className="page-stack">
        <PageHero eyebrow="도구 탐색" title="실시간 MCP 도구를 탐색하세요." description="도구는 각 서버별 제어 플레인 엔드포인트를 통해 불러옵니다." />
        <ErrorState message={servers.error} />
      </div>
    );
  }

  const toolResults = await Promise.all(servers.data.items.map(async (server) => ({ server, tools: await loadResult(listTools(server.id)) })));
  const totalTools = toolResults.reduce((count, result) => count + (result.tools.ok ? result.tools.data.items.length : 0), 0);
  const grantStatusByToolKey = buildGrantStatus(toolResults.flatMap((result) => result.tools.ok ? result.tools.data.items : []), grants.ok ? grants.data.items : []);

  return (
    <div className="page-stack">
      <PageHero eyebrow="도구 탐색" title="호출 가능한 모든 기능을 맥락과 함께." description="각 실제 제어 플레인 도구의 스키마, 위험도, 활성 여부, 권한 범위, 노출 서버를 확인합니다." />
      {servers.data.items.length === 0 ? <EmptyState title="서버 없음" description="도구를 탐색하기 전에 제어 플레인에 서버를 등록하세요." /> : null}
      <div className="card-grid">
        <Surface><SectionHeader title="스캔한 서버" /><p>{servers.data.items.length}</p></Surface>
        <Surface><SectionHeader title="발견한 도구" /><p>{totalTools}</p></Surface>
        <Surface><SectionHeader title="권한 출처" /><p>{grants.ok ? "/api/grants" : "권한 상태 사용 불가"}</p></Surface>
      </div>
      {!grants.ok ? <ErrorState title="권한 상태 사용 불가" message={grants.error} /> : null}
      {toolResults.map(({ server, tools }) => (
        <section key={server.id}>
          <SectionHeader title={server.displayName} description={server.description ?? server.slug} action={<Link className="button button--ghost" href={`/servers/${server.id}`}>서버 상세</Link>} />
          {tools.ok && tools.data.items.length > 0 ? <ToolTable tools={tools.data.items} grantStatusByToolKey={grantStatusByToolKey} showSchema showAccess showAdminPlaceholder /> : tools.ok ? <EmptyState title="도구 없음" description="이 서버가 빈 도구 목록을 반환했습니다." /> : <ErrorState message={tools.error} />}
        </section>
      ))}
    </div>
  );
}

function buildGrantStatus(tools: ApiMcpTool[], grants: { serverId: string; allowedTools: string[]; enabled: boolean; subjectType: string; subjectId: string }[]) {
  const statuses = new Map<string, string>();
  for (const tool of tools) {
    const matching = grants.filter((grant) => grant.enabled && grant.serverId === tool.serverId && (grant.allowedTools.includes(tool.name) || grant.allowedTools.includes("*")));
    statuses.set(`${tool.serverId}:${tool.name}`, matching.length > 0 ? `${matching.length}개 활성 권한: ${matching.map((grant) => `${formatSubjectType(grant.subjectType)}:${grant.subjectId}`).join(", ")}` : "활성 권한이 없습니다");
  }

  return statuses;
}
