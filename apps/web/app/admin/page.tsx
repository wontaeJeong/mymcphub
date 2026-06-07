import { AdminControls, type AdminToolOption } from "../../components/admin-controls";
import { PageHero } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { listServers, listTools } from "../../lib/api";
import { loadResult } from "../../lib/result";

export default async function AdminPage() {
  const servers = await loadResult(listServers());
  const serverItems = servers.ok ? servers.data.items : [];
  const toolResults = await Promise.all(serverItems.map(async (server) => ({ server, tools: await loadResult(listTools(server.id)) })));
  const tools: AdminToolOption[] = toolResults.flatMap(({ server, tools: result }) => result.ok ? result.data.items.map((tool) => ({
    id: tool.id,
    serverId: server.id,
    serverName: server.displayName,
    name: tool.name,
    enabled: tool.enabled
  })) : []);

  return (
    <div className="page-stack">
      <PageHero eyebrow="관리자 긴급 제어" title="근거를 남기고 긴급 제어를 실행하세요." description="긴급 거부, 서버 비활성화, 도구 비활성화, 권한 회수는 존재하는 제어 플레인 엔드포인트만 호출하며 사용할 수 없는 동작은 명확히 표시합니다." />
      {servers.ok ? <AdminControls servers={serverItems} tools={tools} /> : <ErrorState message={servers.error} />}
    </div>
  );
}
