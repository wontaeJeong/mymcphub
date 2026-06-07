import Link from "next/link";
import { EmptyState, Surface } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { ToolTable } from "../../components/tables";
import { ToolTestLab } from "../../components/tool-test-lab";
import { listGrants, listServers, listTools } from "../../lib/api";
import { loadResult } from "../../lib/result";
import { buildGrantStatus, buildToolTestOptions } from "./page-helpers";

export default async function ToolsPage() {
  const serversPromise = loadResult(listServers());
  const grantsPromise = loadResult(listGrants());
  const [servers, grants] = await Promise.all([serversPromise, grantsPromise]);
  if (!servers.ok) {
    return (
      <div className="page-stack">
        <PageHero eyebrow="Tool explorer" title="Explore live MCP tools." description="Tools are loaded through each server-specific Control Plane endpoint." />
        <ErrorState message={servers.error} />
      </div>
    );
  }

  const toolResults = await Promise.all(servers.data.items.map(async (server) => ({ server, tools: await loadResult(listTools(server.id)) })));
  const toolItems = toolResults.flatMap((result) => result.tools.ok ? result.tools.data.items : []);
  const totalTools = toolResults.reduce((count, result) => count + (result.tools.ok ? result.tools.data.items.length : 0), 0);
  const grantStatusByToolKey = buildGrantStatus(toolItems, grants.ok ? grants.data.items : []);
  const testOptions = buildToolTestOptions(servers.data.items, toolItems);

  return (
    <div className="page-stack">
      <PageHero eyebrow="Tool explorer" title="Every callable capability, in context." description="Inspect tool schemas, risk, enablement, grant coverage, and the server that exposes each real Control Plane tool." />
      {servers.data.items.length === 0 ? <EmptyState title="No servers" description="Register servers in the Control Plane before exploring tools." /> : null}
      <div className="card-grid">
        <Surface><SectionHeader title="Servers scanned" /><p>{servers.data.items.length}</p></Surface>
        <Surface><SectionHeader title="Tools found" /><p>{totalTools}</p></Surface>
        <Surface><SectionHeader title="Grant source" /><p>{grants.ok ? "/api/grants" : "Grant status unavailable"}</p></Surface>
      </div>
      {!grants.ok ? <ErrorState title="Grant status unavailable" message={grants.error} /> : null}
      <ToolTestLab options={testOptions} />
      {toolResults.map(({ server, tools }) => (
        <section key={server.id}>
          <SectionHeader title={server.displayName} description={server.description ?? server.slug} action={<Link className="button button--ghost" href={`/servers/${server.id}`}>Server detail</Link>} />
          {tools.ok && tools.data.items.length > 0 ? <ToolTable tools={tools.data.items} grantStatusByToolKey={grantStatusByToolKey} showSchema showAccess /> : tools.ok ? <EmptyState title="No tools" description="This server returned an empty tool list." /> : <ErrorState message={tools.error} />}
        </section>
      ))}
    </div>
  );
}
