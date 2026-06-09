import { AdminControls, type AdminToolOption } from "../../../components/admin-controls";
import { PageHero } from "../../../components/chrome";
import { ErrorState } from "../../../components/states";
import { listServers, listTools } from "../../../lib/api";
import { loadResult } from "../../../lib/result";

export default async function EmergencyPage() {
  const servers = await loadResult(listServers());
  const serverItems = servers.ok ? servers.data.items : [];
  const toolResults = await Promise.all(serverItems.map(async (server) => ({ server, tools: await loadResult(listTools(server.id)) })));
  const tools: AdminToolOption[] = toolResults.flatMap(({ server, tools: result }) => result.ok ? result.data.items.map((tool) => ({
    id: tool.id,
    serverId: server.id,
    serverName: server.displayName,
    name: tool.name,
    enabled: tool.enabled,
  })) : []);

  return (
    <div className="page-stack">
      <PageHero eyebrow="관리자 긴급 제어" title="전체 차단과 대상별 조치를 구분하세요." description="허브 전체 긴급 거부를 먼저 판단하고, 서버·도구·권한 조치는 위험 구역에서 대상 확인 후 실행합니다." />
      {servers.ok ? <AdminControls servers={serverItems} tools={tools} /> : <ErrorState message={servers.error} />}
    </div>
  );
}
