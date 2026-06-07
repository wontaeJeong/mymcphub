import { EmptyState, Surface } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { HealthTable, RolloutStatusTable, ServerTable } from "../../components/tables";
import {
  listDeniedCallAnalytics,
  listServerHealth,
  listServers,
  listServerVersions,
  listUsageReport,
} from "../../lib/api";
import { loadResult } from "../../lib/result";
import { buildRolloutStatusRows } from "./page-helpers";

export async function OperationsPageContent() {
  const serversPromise = loadResult(listServers());
  const healthPromise = loadResult(listServerHealth());
  const usagePromise = loadResult(listUsageReport("daily"));
  const deniedPromise = loadResult(listDeniedCallAnalytics());
  const [servers, health, usage, denied] = await Promise.all([
    serversPromise,
    healthPromise,
    usagePromise,
    deniedPromise,
  ]);
  const serverItems = servers.ok ? servers.data.items : [];
  const healthItems = health.ok ? health.data.items : [];
  const usageItems = usage.ok ? usage.data.items : [];
  const deniedReasons = denied.ok ? denied.data.byReason : [];
  const serverNameById = new Map(
    serverItems.map((server) => [server.id, server.displayName]),
  );
  const healthByServerId = new Map(
    healthItems.map((check) => [check.serverId, check]),
  );
  const versionResults = await Promise.all(
    serverItems.map(async (server) => ({
      server,
      versions: await loadResult(listServerVersions(server.id)),
    })),
  );
  const versionsByServerId = new Map(
    versionResults.map(({ server, versions }) => [
      server.id,
      versions.ok ? versions.data.items : [],
    ]),
  );
  const versionErrors = versionResults.filter((result) => !result.versions.ok);
  const rolloutRows = buildRolloutStatusRows(
    serverItems,
    versionsByServerId,
    healthByServerId,
  );
  const incidentCount = healthItems.filter(
    (check) => check.status !== "healthy",
  ).length;
  const totalToolCalls = usageItems.reduce((sum, item) => sum + item.calls, 0);
  const deniedToolCalls = denied.ok ? denied.data.totalDenied : 0;
  const displayedUsageItems = [...usageItems]
    .sort(
      (a, b) =>
        b.period.localeCompare(a.period) ||
        b.calls - a.calls ||
        usageItemKey(a).localeCompare(usageItemKey(b)),
    )
      .slice(0, 10);

  return (
    <div className="page-stack">
      <PageHero
        eyebrow="Health and operations"
        title="Keep the hub in service."
        description="Watch server status, denied-call analytics, usage accounting, and health worker output from the Control Plane."
      />
      <div className="card-grid">
        <Surface>
          <SectionHeader title="Servers" />
          <p>{serverItems.length}</p>
        </Surface>
        <Surface>
          <SectionHeader title="Disabled" />
          <p>{serverItems.filter((server) => !server.enabled).length}</p>
        </Surface>
        <Surface>
          <SectionHeader title="Incidents" />
          <p>{incidentCount}</p>
        </Surface>
        <Surface>
          <SectionHeader title="Published" />
          <p>{serverItems.filter((server) => server.published).length}</p>
        </Surface>
        <Surface>
          <SectionHeader title="Quarantined" />
          <p>{serverItems.filter((server) => server.quarantined).length}</p>
        </Surface>
        <Surface>
          <SectionHeader title="Active rollouts" />
          <p>{rolloutRows.filter((row) => row.activeVersion).length}</p>
        </Surface>
        <Surface>
          <SectionHeader title="Tool calls" />
          <p>{totalToolCalls}</p>
        </Surface>
        <Surface>
          <SectionHeader title="Denied calls" />
          <p>{deniedToolCalls}</p>
        </Surface>
      </div>
      {versionErrors.length > 0 ? (
        <ErrorState
          title="Rollout versions partially unavailable"
          message={`${versionErrors.length} server version request(s) failed while building rollout status.`}
        />
      ) : null}
      <section>
        <SectionHeader
          title="Denied-call analytics"
          description="Aggregated policy deny reasons and top denied tools from /api/analytics/denied-calls."
        />
        {denied.ok && deniedReasons.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Count</th>
                  <th>Policy tuning guidance</th>
                </tr>
              </thead>
              <tbody>
                {deniedReasons.map((reason) => {
                  const tuning = denied.data.policyTuning.find(
                    (item) => item.reason === reason.reason,
                  );
                  return (
                    <tr key={reason.reason}>
                      <td>{reason.reason}</td>
                      <td>{reason.count}</td>
                      <td>
                        {tuning?.message ??
                          "Review grants and policy before tuning."}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : denied.ok ? (
          <EmptyState
            title="No denied calls"
            description="No denied tool calls were found in the current audit window."
          />
        ) : (
          <ErrorState message={denied.error} />
        )}
      </section>
      <section>
        <SectionHeader
          title="Rollout and quarantine status"
          description="Combines /api/servers, /api/servers/:serverId/versions, and /api/server-health so operators can see active versions, rollout freshness, and quarantine state together."
        />
        {servers.ok && rolloutRows.length > 0 ? (
          <RolloutStatusTable rows={rolloutRows} serverBasePath="/admin/servers" />
        ) : servers.ok ? (
          <EmptyState
            title="No rollout rows"
            description="Register servers before rollout status can be shown."
          />
        ) : (
          <ErrorState message={servers.error} />
        )}
      </section>
      <section>
        <SectionHeader
          title="Usage accounting"
          description="Daily team/project/user/server/tool aggregation from /api/analytics/usage."
        />
        {usage.ok && usageItems.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Server</th>
                  <th>Tool</th>
                  <th>Calls</th>
                  <th>Denied</th>
                  <th>p95</th>
                  <th>p99</th>
                </tr>
              </thead>
              <tbody>
                {displayedUsageItems.map((item) => (
                  <tr key={usageItemKey(item)}>
                    <td>{item.period}</td>
                    <td>
                      {serverNameById.get(item.serverId ?? "") ??
                        item.serverId ??
                        "Hub"}
                    </td>
                    <td>{item.toolName ?? "All tools"}</td>
                    <td>{item.calls}</td>
                    <td>{item.denied}</td>
                    <td>{item.p95LatencyMs} ms</td>
                    <td>{item.p99LatencyMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : usage.ok ? (
          <EmptyState
            title="No usage rows"
            description="Tool-call audit events will appear here after Gateway traffic is recorded."
          />
        ) : (
          <ErrorState message={usage.error} />
        )}
      </section>
      <section>
        <SectionHeader
          title="Server health"
          description="Rows returned by /api/server-health."
        />
        {health.ok && healthItems.length > 0 ? (
          <HealthTable checks={healthItems} serverNameById={serverNameById} />
        ) : health.ok ? (
          <EmptyState
            title="No health checks"
            description="The Control Plane returned no health checks."
          />
        ) : (
          <ErrorState message={health.error} />
        )}
      </section>
      <section>
        <SectionHeader
          title="Operational catalog state"
          description="Server enablement and risk posture for operations review."
        />
        {servers.ok && serverItems.length > 0 ? (
          <ServerTable
            servers={serverItems}
            healthByServerId={healthByServerId}
            serverBasePath="/admin/servers"
          />
        ) : servers.ok ? (
          <EmptyState
            title="No servers"
            description="The Control Plane returned no catalog entries."
          />
        ) : (
          <ErrorState message={servers.error} />
        )}
      </section>
    </div>
  );
}

function usageItemKey(item: {
  period: string;
  teamId?: string;
  projectId?: string;
  userId?: string;
  clientId?: string;
  serverId?: string;
  toolName?: string;
}) {
  return [
    item.period,
    item.teamId ?? "team",
    item.projectId ?? "project",
    item.userId ?? "user",
    item.clientId ?? "client",
    item.serverId ?? "server",
    item.toolName ?? "tool",
  ].join(":");
}
