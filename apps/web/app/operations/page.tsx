import { EmptyState, Surface } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { HealthTable, ServerTable } from "../../components/tables";
import { listServerHealth, listServers } from "../../lib/api";
import { loadResult } from "../../lib/result";

export default async function OperationsPage() {
  const serversPromise = loadResult(listServers());
  const healthPromise = loadResult(listServerHealth());
  const [servers, health] = await Promise.all([serversPromise, healthPromise]);
  const serverItems = servers.ok ? servers.data.items : [];
  const healthItems = health.ok ? health.data.items : [];
  const serverNameById = new Map(serverItems.map((server) => [server.id, server.displayName]));
  const incidentCount = healthItems.filter((check) => check.status !== "healthy").length;

  return (
    <div className="page-stack">
      <PageHero eyebrow="상태 및 운영" title="허브를 안정적으로 운영하세요." description="제어 플레인의 서버 상태, 비활성 카탈로그 항목, 상태 워커 출력을 확인합니다." />
      <div className="card-grid">
        <Surface><SectionHeader title="서버" /><p>{serverItems.length}</p></Surface>
        <Surface><SectionHeader title="비활성" /><p>{serverItems.filter((server) => !server.enabled).length}</p></Surface>
        <Surface><SectionHeader title="장애" /><p>{incidentCount}</p></Surface>
      </div>
      <section>
        <SectionHeader title="서버 상태" description="/api/server-health가 반환한 행입니다." />
        {health.ok && healthItems.length > 0 ? <HealthTable checks={healthItems} serverNameById={serverNameById} /> : health.ok ? <EmptyState title="상태 확인 없음" description="제어 플레인이 상태 확인을 반환하지 않았습니다." /> : <ErrorState message={health.error} />}
      </section>
      <section>
        <SectionHeader title="운영 카탈로그 상태" description="운영 검토를 위한 서버 활성 여부와 위험 수준입니다." />
        {servers.ok && serverItems.length > 0 ? <ServerTable servers={serverItems} /> : servers.ok ? <EmptyState title="서버 없음" description="제어 플레인이 카탈로그 항목을 반환하지 않았습니다." /> : <ErrorState message={servers.error} />}
      </section>
    </div>
  );
}
