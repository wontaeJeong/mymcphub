import Link from "next/link";
import { EmptyState, Surface } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { GrantTable, ServerTable } from "../../components/tables";
import { getCurrentSession } from "../../lib/auth/session";
import { listGrants, listServers } from "../../lib/api";
import { loadResult } from "../../lib/result";

export default async function UserHomePage() {
  const session = await getCurrentSession();
  const [servers, grants] = await Promise.all([loadResult(listServers()), loadResult(listGrants())]);
  const serverItems = servers.ok ? servers.data.items.filter((server) => server.enabled) : [];
  const userGrants = grants.ok ? grants.data.items.filter((grant) => grant.enabled && (grant.subjectId === session?.principal.userId || session?.principal.teamIds.includes(grant.subjectId) || session?.principal.teams.includes(grant.subjectId))) : [];
  const serverNameById = new Map(serverItems.map((server) => [server.id, server.displayName]));

  return (
    <div className="page-stack">
      <PageHero eyebrow="User workspace" title="Find tools you can actually use." description="Browse MCP servers, request missing access, and generate client configuration without exposing admin-only operations." />
      <div className="card-grid">
        <Surface><SectionHeader title="Enabled servers" /><p>{serverItems.length}</p></Surface>
        <Surface><SectionHeader title="Visible grants" /><p>{userGrants.length}</p></Surface>
        <Surface><SectionHeader title="Admin access" /><p>{session?.principal.isPlatformAdmin ? "Available" : "Not granted"}</p></Surface>
      </div>
      {!servers.ok ? <ErrorState message={servers.error} /> : null}
      <section>
        <SectionHeader title="User actions" description="Self-service pages are separated from the admin console." />
        <div className="card-grid">
          <UserLink href="/user/catalog" title="Browse catalog" description="Inspect servers and tools exposed by the hub." />
          <UserLink href="/user/access" title="Request access" description="Submit approval requests and review your current grants." />
          <UserLink href="/user/client-config" title="Client config" description="Generate MCP client snippets for enabled servers." />
        </div>
      </section>
      <section>
        <SectionHeader title="Enabled catalog preview" description="Server links stay in the user route tree." action={<Link className="button" href="/user/catalog">Open catalog</Link>} />
        {servers.ok && serverItems.length > 0 ? <ServerTable servers={serverItems.slice(0, 5)} serverBasePath="/user/servers" /> : servers.ok ? <EmptyState title="No enabled servers" description="No enabled servers were returned by the Control Plane." /> : null}
      </section>
      <section>
        <SectionHeader title="Your visible grants" description="Filtered to the current user or team identifiers available in the Web session." action={<Link className="button" href="/user/access">Open access</Link>} />
        {grants.ok && userGrants.length > 0 ? <GrantTable grants={userGrants} serverNameById={serverNameById} /> : grants.ok ? <EmptyState title="No visible grants" description="Request access when a required tool is missing." /> : <ErrorState message={grants.error} />}
      </section>
    </div>
  );
}

function UserLink({ href, title, description }: Readonly<{ href: string; title: string; description: string }>) {
  return <Link className="panel" href={href}><h2>{title}</h2><p>{description}</p></Link>;
}
