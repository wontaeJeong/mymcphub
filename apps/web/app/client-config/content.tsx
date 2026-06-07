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
      <PageHero eyebrow="Client config generator" title="Turn approved servers into client-ready snippets." description="Submit real /api/client-config/generate requests for opencode, Claude Code, Codex, VS Code, or generic remote MCP clients." />
      {servers.ok && enabledServers.length > 0 ? <ClientConfigForm servers={enabledServers} /> : servers.ok ? <EmptyState title="No enabled servers" description="Client configs can only be generated for enabled servers." /> : <ErrorState message={servers.error} />}
    </div>
  );
}
