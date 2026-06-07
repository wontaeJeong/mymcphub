import Link from "next/link";
import { EmptyState } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { DashboardSummary, FirstRunOnboarding, NeedsAttention, type AttentionItem } from "../../components/dashboard-summary";
import { ErrorState } from "../../components/states";
import { listApprovals, listAuditEvents, listServerHealth, listServers, listToolCallEvents, listTools } from "../../lib/api";
import { loadResult } from "../../lib/result";

export default async function AdminPage() {
  const [servers, approvals, audit, health, calls] = await Promise.all([
    loadResult(listServers()),
    loadResult(listApprovals()),
    loadResult(listAuditEvents({ limit: 25 })),
    loadResult(listServerHealth()),
    loadResult(listToolCallEvents()),
  ]);
  const serverItems = servers.ok ? servers.data.items : [];
  const toolResults = await Promise.all(
    serverItems.map(async (server) => ({
      server,
      tools: await loadResult(listTools(server.id)),
    })),
  );
  const toolItems = toolResults.flatMap((result) => result.tools.ok ? result.tools.data.items : []);
  const highCriticalTools = toolItems.filter((tool) => tool.riskLevel === "high" || tool.riskLevel === "critical").length;
  const toolErrors = toolResults.filter((result) => !result.tools.ok).length;
  const pendingApprovals = approvals.ok ? approvals.data.items.filter((approval) => approval.status === "pending") : [];
  const deniedEvents = audit.ok ? audit.data.items.filter((event) => event.policyDecision === "deny") : [];
  const unhealthy = health.ok ? health.data.items.filter((item) => item.status !== "healthy") : [];
  const failedCalls = calls.ok ? calls.data.items.filter((call) => !isSuccessfulToolCallStatus(call.status)) : [];
  const unavailableSurfaces = [
    servers.ok ? undefined : "servers",
    approvals.ok ? undefined : "approvals",
    audit.ok ? undefined : "audit",
    health.ok ? undefined : "health",
    calls.ok ? undefined : "tool calls",
    toolErrors > 0 ? "tool discovery" : undefined,
  ].filter((surface): surface is string => Boolean(surface));
  const attentionItems: AttentionItem[] = [];
  if (pendingApprovals.length > 0) {
    attentionItems.push({ title: `${pendingApprovals.length} approval request${pendingApprovals.length === 1 ? "" : "s"} pending`, detail: "Review access before it becomes a stale permission path.", href: "/admin/approvals", action: "Open approvals", tone: "warning" });
  }
  if (unhealthy.length > 0) {
    attentionItems.push({ title: `${unhealthy.length} server health signal${unhealthy.length === 1 ? "" : "s"} need review`, detail: "Degraded or unhealthy checks can block reliable client use.", href: "/admin/operations", action: "Review health", tone: "danger" });
  }
  if (highCriticalTools > 0) {
    attentionItems.push({ title: `${highCriticalTools} high-risk tool${highCriticalTools === 1 ? "" : "s"} in catalog`, detail: "Confirm grants and risk posture before broad access.", href: "/admin/servers", action: "Review servers", tone: "warning" });
  }
  if (deniedEvents.length > 0) {
    attentionItems.push({ title: `${deniedEvents.length} recent denied call${deniedEvents.length === 1 ? "" : "s"}`, detail: "Denied calls can reveal missing grants or policy drift.", href: "/admin/audit", action: "Open audit", tone: "info" });
  }
  if (failedCalls.length > 0) {
    attentionItems.push({ title: `${failedCalls.length} failed tool call${failedCalls.length === 1 ? "" : "s"}`, detail: "Review failures before asking clients to retry.", href: "/admin/audit", action: "Inspect calls", tone: "danger" });
  }
  if (unavailableSurfaces.length > 0) {
    attentionItems.push({ title: "Some backend data is unavailable", detail: `Unavailable: ${unavailableSurfaces.join(", ")}. Empty tables may not mean no activity.`, href: "/admin/operations", action: "Review operations", tone: "warning" });
  }

  return (
    <div className="page-stack">
      <PageHero eyebrow="Admin dashboard" title="Know what needs action first." description="Start with attention items, then move into servers, access decisions, audit review, or incident controls." />
      <NeedsAttention items={attentionItems} />
      {servers.ok && serverItems.length === 0 ? <FirstRunOnboarding admin /> : null}
      <DashboardSummary
        registeredServers={serverItems.length}
        enabledServers={serverItems.filter((server) => server.enabled).length}
        disabledServers={serverItems.filter((server) => !server.enabled).length}
        highCriticalTools={highCriticalTools}
        recentDeniedCalls={deniedEvents.length}
        recentFailedCalls={failedCalls.length + unhealthy.length}
        activeSessionStatus="Unavailable"
        activeSessionDetail="Session metrics unavailable from the current backend"
      />
      {!servers.ok ? <ErrorState message={servers.error} /> : null}
      <section>
        <SectionHeader title="Admin workspaces" description="Daily operations and governance are first. Emergency controls stay under Admin for incident use only." />
        <div className="card-grid">
          <AdminLink href="/admin/servers" title="Servers" description="Register servers, inspect tools, and manage enablement." />
          <AdminLink href="/admin/access" title="Access Grants" description="Review grants, create scoped access, and revoke when needed." />
          <AdminLink href="/admin/approvals" title="Approvals" description="Approve or reject pending access requests." />
          <AdminLink href="/admin/audit" title="Audit" description="Trace decisions, policy outcomes, and tool-call records." />
          <AdminLink href="/admin/operations" title="Operations" description="Review health, rollout, usage, and denied-call analytics." />
          <AdminLink href="/admin/emergency" title="Admin / Emergency" description="Use destructive incident controls only with explicit confirmation." />
          {serverItems.length === 0 ? <EmptyState title="No data yet" description="Register a server to unlock tools, grants, operations, and client setup." /> : null}
        </div>
      </section>
    </div>
  );
}

function AdminLink({ href, title, description }: Readonly<{ href: string; title: string; description: string }>) {
  return <Link className="panel" href={href}><h2>{title}</h2><p>{description}</p></Link>;
}

function isSuccessfulToolCallStatus(status: string) {
  const normalized = status.toLowerCase();
  return normalized === "ok" || normalized === "success" || normalized === "succeeded";
}
