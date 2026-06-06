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
      <PageHero eyebrow="Admin emergency controls" title="Use the red switches with receipts." description="Emergency deny, server disable, tool disable, and grant revocation call existing Control Plane endpoints where present and label unavailable behavior explicitly." />
      {servers.ok ? <AdminControls servers={serverItems} tools={tools} /> : <ErrorState message={servers.error} />}
    </div>
  );
}
