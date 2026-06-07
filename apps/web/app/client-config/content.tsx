import { EmptyState } from "@mcp-hub/ui";

import { PageHero } from "../../components/chrome";
import { ClientConfigForm } from "../../components/client-config-form";
import { ErrorState } from "../../components/states";
import { listServers } from "../../lib/api";
import { loadResult } from "../../lib/result";

export async function ClientConfigPageContent() {
  const servers = await loadResult(listServers());
  const enabledServers = servers.ok ? servers.data.items.filter((server) => server.enabled) : [];

  return (
    <div className="page-stack">
      <PageHero eyebrow="Client Setup" title="Turn approved servers into client-ready snippets." description="Generate setup for opencode, Claude Code, Codex, VS Code, or generic remote MCP clients after access is ready." />
      {servers.ok && enabledServers.length > 0 ? <ClientConfigForm servers={enabledServers} /> : servers.ok ? <EmptyState title="No data yet" description="Enable a registered server before generating client setup." /> : <ErrorState message={servers.error} />}
    </div>
  );
}
