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
      <PageHero eyebrow="위험 작업" title="긴급 조치" description="전체 차단, 서버 비활성화, 도구 비활성화, 권한 회수를 실행합니다." />
      {servers.ok ? <AdminControls servers={serverItems} tools={tools} /> : <ErrorState message={servers.error} />}
    </div>
  );
}
