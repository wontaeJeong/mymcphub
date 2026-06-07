import Link from "next/link";
import { EmptyState, Surface } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { listApprovals, listAuditEvents, listServerHealth, listServers } from "../../lib/api";
import { loadResult } from "../../lib/result";

export default async function AdminPage() {
  const [servers, approvals, audit, health] = await Promise.all([
    loadResult(listServers()),
    loadResult(listApprovals()),
    loadResult(listAuditEvents({ limit: 25 })),
    loadResult(listServerHealth()),
  ]);
  const serverItems = servers.ok ? servers.data.items : [];
  const pendingApprovals = approvals.ok ? approvals.data.items.filter((approval) => approval.status === "pending") : [];
  const deniedEvents = audit.ok ? audit.data.items.filter((event) => event.policyDecision === "deny") : [];
  const unhealthy = health.ok ? health.data.items.filter((item) => item.status !== "healthy") : [];

  return (
    <div className="page-stack">
      <PageHero eyebrow="Admin console" title="Operate the hub with explicit authority." description="Admin routes are separated from user self-service and require platform admin role or group mapping before rendering." />
      <div className="card-grid">
        <Surface><SectionHeader title="Servers" /><p>{serverItems.length}</p></Surface>
        <Surface><SectionHeader title="Pending approvals" /><p>{pendingApprovals.length}</p></Surface>
        <Surface><SectionHeader title="Denied events" /><p>{deniedEvents.length}</p></Surface>
        <Surface><SectionHeader title="Health incidents" /><p>{unhealthy.length}</p></Surface>
      </div>
      {!servers.ok ? <ErrorState message={servers.error} /> : null}
      <section>
        <SectionHeader title="Admin workspaces" description="Server operations, approval decisions, audit review, health operations, and emergency controls are isolated from the user workspace." />
        <div className="card-grid">
          <AdminLink href="/admin/servers" title="Server management" description="Register servers and operate server detail controls." />
          <AdminLink href="/admin/approvals" title="Approval queue" description="Approve or reject pending access requests." />
          <AdminLink href="/admin/audit" title="Audit log" description="Inspect audit events and compliance exports." />
          <AdminLink href="/admin/operations" title="Operations" description="Review health, rollout, usage, and denied-call analytics." />
          <AdminLink href="/admin/emergency" title="Emergency controls" description="Enable deny controls and revoke grants during incidents." />
          {serverItems.length === 0 ? <EmptyState title="No servers" description="Register a server from the admin server management page." /> : null}
        </div>
      </section>
    </div>
  );
}

function AdminLink({ href, title, description }: Readonly<{ href: string; title: string; description: string }>) {
  return <Link className="panel" href={href}><h2>{title}</h2><p>{description}</p></Link>;
}
