import Link from "next/link";
import { EmptyState, Surface, StatusPill } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../components/chrome";
import { DashboardSummary } from "../components/dashboard-summary";
import { formatDate, healthTone } from "../components/format";
import { ErrorState } from "../components/states";
import { ApprovalTable, AuditTable, HealthTable, ServerTable } from "../components/tables";
import { getMe, listApprovals, listAuditEvents, listServerHealth, listServers, listToolCallEvents, listTools } from "../lib/api";
import { loadResult } from "../lib/result";

export default async function Page() {
  const mePromise = loadResult(getMe());
  const serversPromise = loadResult(listServers());
  const approvalsPromise = loadResult(listApprovals());
  const healthPromise = loadResult(listServerHealth());
  const auditPromise = loadResult(listAuditEvents({ limit: 25 }));
  const toolCallsPromise = loadResult(listToolCallEvents());
  const [me, servers, approvals, health, audit, toolCalls] = await Promise.all([
    mePromise,
    serversPromise,
    approvalsPromise,
    healthPromise,
    auditPromise,
    toolCallsPromise
  ]);

  const serverItems = servers.ok ? servers.data.items : [];
  const approvalItems = approvals.ok ? approvals.data.items : [];
  const healthItems = health.ok ? health.data.items : [];
  const auditItems = audit.ok ? audit.data.items : [];
  const toolCallItems = toolCalls.ok ? toolCalls.data.items : [];
  const toolResults = await Promise.all(serverItems.map(async (server) => loadResult(listTools(server.id))));
  const toolItems = toolResults.flatMap((result) => result.ok ? result.data.items : []);
  const unhealthyServers = healthItems.filter((check) => check.status !== "healthy").length;
  const failedToolCalls = toolCallItems.filter((event) => !isSuccessfulToolCallStatus(event.status)).length;
  const serverNameById = new Map(serverItems.map((server) => [server.id, server.displayName]));

  return (
    <div className="page-stack">
      <PageHero
        eyebrow="Operations dashboard"
        title="One live console for MCP governance."
        description="Prompt 05 Web UI connects to the Control Plane API and renders empty or error states when the service has no data or is offline."
      />

      {servers.ok || audit.ok || toolCalls.ok || health.ok ? (
        <DashboardSummary
          registeredServers={serverItems.length}
          enabledServers={serverItems.filter((server) => server.enabled).length}
          disabledServers={serverItems.filter((server) => !server.enabled).length}
          highCriticalTools={toolItems.filter((tool) => tool.riskLevel === "high" || tool.riskLevel === "critical").length}
          recentDeniedCalls={auditItems.filter((event) => event.policyDecision === "deny").length}
          recentFailedCalls={failedToolCalls + unhealthyServers}
          activeSessionStatus="Unavailable"
          activeSessionDetail="No prompt-05 Control Plane session endpoint"
        />
      ) : (
        <ErrorState message={servers.ok ? "Control Plane metrics are unavailable." : servers.error} />
      )}

      <div className="detail-grid">
        <Surface className="panel--accent">
          <SectionHeader eyebrow="Identity" title="Current operator" description="Auth context returned by /api/me." />
          {me.ok ? (
            <div className="grid">
              <p><strong>{me.data.auth.displayName}</strong></p>
              <p className="muted">{me.data.auth.email}</p>
              <div className="actions">
                {me.data.auth.roles.map((role) => <StatusPill tone="info" key={role}>{role}</StatusPill>)}
              </div>
            </div>
          ) : (
            <ErrorState message={me.error} />
          )}
        </Surface>
        <Surface>
          <SectionHeader eyebrow="Health" title="Latest signal" description="Most recent server health rows." />
          {health.ok && healthItems.length > 0 ? (
            <div className="grid">
              {healthItems.slice(0, 3).map((check) => (
                <p key={check.id}>
                  <StatusPill tone={healthTone(check.status)}>{check.status}</StatusPill>{" "}
                  {serverNameById.get(check.serverId) ?? check.serverId} · {formatDate(check.checkedAt)}
                </p>
              ))}
            </div>
          ) : health.ok ? (
            <EmptyState title="No health checks" description="Health rows will appear when the worker writes server status." />
          ) : (
            <ErrorState message={health.error} />
          )}
        </Surface>
      </div>

      <section>
        <SectionHeader title="Server catalog" description="A quick look at registered MCP servers." action={<Link className="button" href="/catalog">Open catalog</Link>} />
        {servers.ok && serverItems.length > 0 ? <ServerTable servers={serverItems.slice(0, 6)} /> : servers.ok ? <EmptyState title="No servers" description="The Control Plane returned an empty server catalog." /> : <ErrorState message={servers.error} />}
      </section>

      <section>
        <SectionHeader title="Approval queue" description="Pending access requests awaiting review." action={<Link className="button" href="/approvals">Review queue</Link>} />
        {approvals.ok && approvalItems.length > 0 ? <ApprovalTable approvals={approvalItems.slice(0, 5)} /> : approvals.ok ? <EmptyState title="No approvals" description="There are no approval requests in the queue." /> : <ErrorState message={approvals.error} />}
      </section>

      <section>
        <SectionHeader title="Audit pulse" description="Recent policy and administrative audit events." action={<Link className="button" href="/audit">Open audit log</Link>} />
        {audit.ok && auditItems.length > 0 ? <AuditTable events={auditItems.slice(0, 8)} /> : audit.ok ? <EmptyState title="No audit events" description="No audit events were returned by the API." /> : <ErrorState message={audit.error} />}
      </section>

      <section>
        <SectionHeader title="Health operations" description="Status by server health check." action={<Link className="button" href="/operations">Open operations</Link>} />
        {health.ok && healthItems.length > 0 ? <HealthTable checks={healthItems} serverNameById={serverNameById} /> : health.ok ? <EmptyState title="No health rows" description="The Control Plane returned no server health checks." /> : <ErrorState message={health.error} />}
      </section>
    </div>
  );
}

function isSuccessfulToolCallStatus(status: string) {
  const normalized = status.toLowerCase();
  return normalized === "ok" || normalized === "success" || normalized === "succeeded";
}
