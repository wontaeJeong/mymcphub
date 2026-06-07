import Link from "next/link";
import { EmptyState, StatusPill, Surface } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../../../components/chrome";
import { enabledTone, formatDate, healthTone, riskTone } from "../../../../components/format";
import { ErrorState } from "../../../../components/states";
import { GrantTable, ToolTable } from "../../../../components/tables";
import { getCurrentSession } from "../../../../lib/auth/session";
import { getServer, listGrants, listServerHealth, listTools } from "../../../../lib/api";
import { loadResult } from "../../../../lib/result";
import { buildGrantStatus } from "../../../tools/page-helpers";
import { selectServerHealth } from "../../../servers/[serverId]/page-helpers";

type UserServerDetailPageProps = Readonly<{
  params: Promise<{ serverId: string }>;
}>;

export default async function UserServerDetailPage({ params }: UserServerDetailPageProps) {
  const { serverId } = await params;
  const session = await getCurrentSession();
  const [server, tools, health, grants] = await Promise.all([
    loadResult(getServer(serverId)),
    loadResult(listTools(serverId)),
    loadResult(listServerHealth()),
    loadResult(listGrants()),
  ]);

  if (!server.ok) {
    return <div className="page-stack"><PageHero eyebrow="Server detail" title="Server unavailable." description="The Control Plane could not return this MCP server." /><ErrorState message={server.error} /><Link className="button" href="/user/catalog">Back to catalog</Link></div>;
  }

  const latestHealth = health.ok ? selectServerHealth(health.data.items, serverId) : undefined;
  const toolItems = tools.ok ? tools.data.items : [];
  const visibleGrants = grants.ok ? grants.data.items.filter((grant) => grant.serverId === serverId && grant.enabled && (grant.subjectId === session?.principal.userId || session?.principal.teamIds.includes(grant.subjectId) || session?.principal.teams.includes(grant.subjectId))) : [];
  const grantStatusByToolKey = buildGrantStatus(toolItems, visibleGrants);
  const serverNameById = new Map([[server.data.id, server.data.displayName]]);

  return (
    <div className="page-stack">
      <PageHero eyebrow={server.data.slug} title={server.data.displayName} description={server.data.description ?? "No server description published."} />
      <div className="detail-grid">
        <Surface>
          <SectionHeader title="Server profile" description="Read-only Control Plane metadata for this MCP server." />
          <div className="grid">
            <p><strong>Server ID:</strong> {server.data.id}</p>
            <p><strong>Owner team:</strong> {server.data.ownerTeamId}</p>
            <p><strong>Environment:</strong> {server.data.environment}</p>
            <p><strong>Transport:</strong> {server.data.transport}</p>
            <p><strong>Created:</strong> {formatDate(server.data.createdAt)}</p>
            <p><strong>Updated:</strong> {formatDate(server.data.updatedAt)}</p>
          </div>
        </Surface>
        <Surface className="panel--accent">
          <SectionHeader title="Access posture" description="User pages show state only; admin controls live under /admin." />
          <div className="actions">
            <StatusPill tone={riskTone(server.data.riskLevel)}>{server.data.riskLevel}</StatusPill>
            <StatusPill tone={enabledTone(server.data.enabled)}>{server.data.enabled ? "enabled" : "disabled"}</StatusPill>
            {latestHealth ? <StatusPill tone={healthTone(latestHealth.status)}>{latestHealth.status}</StatusPill> : <StatusPill>health unavailable</StatusPill>}
          </div>
        </Surface>
      </div>
      <section>
        <SectionHeader title="Tools" description="Tool schema and grant status for your visible user/team grants." />
        {tools.ok && toolItems.length > 0 ? <ToolTable tools={toolItems} grantStatusByToolKey={grantStatusByToolKey} showSchema showAccess /> : tools.ok ? <EmptyState title="No tools discovered" description="The server exists, but no tools were returned by the Control Plane." /> : <ErrorState message={tools.error} />}
      </section>
      <section>
        <SectionHeader title="Your grants on this server" description="Filtered to this server and current session identifiers." />
        {grants.ok && visibleGrants.length > 0 ? <GrantTable grants={visibleGrants} serverNameById={serverNameById} /> : grants.ok ? <EmptyState title="No matching grant" description="Request access if you need to use one of these tools." /> : <ErrorState message={grants.error} />}
      </section>
    </div>
  );
}
