import { EmptyState, Surface } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { HealthTable, RolloutStatusTable, ServerTable } from "../../components/tables";
import { listServerHealth, listServers, listServerVersions } from "../../lib/api";
import { loadResult } from "../../lib/result";
import { buildRolloutStatusRows } from "./page-helpers";

export default async function OperationsPage() {
  const serversPromise = loadResult(listServers());
  const healthPromise = loadResult(listServerHealth());
  const [servers, health] = await Promise.all([serversPromise, healthPromise]);
  const serverItems = servers.ok ? servers.data.items : [];
  const healthItems = health.ok ? health.data.items : [];
  const serverNameById = new Map(serverItems.map((server) => [server.id, server.displayName]));
  const healthByServerId = new Map(healthItems.map((check) => [check.serverId, check]));
  const versionResults = await Promise.all(serverItems.map(async (server) => ({ server, versions: await loadResult(listServerVersions(server.id)) })));
  const versionsByServerId = new Map(versionResults.map(({ server, versions }) => [server.id, versions.ok ? versions.data.items : []]));
  const versionErrors = versionResults.filter((result) => !result.versions.ok);
  const rolloutRows = buildRolloutStatusRows(serverItems, versionsByServerId, healthByServerId);
  const incidentCount = healthItems.filter((check) => check.status !== "healthy").length;

  return (
    <div className="page-stack">
      <PageHero eyebrow="Health and operations" title="Keep the hub in service." description="Watch server status, disabled catalog entries, and health worker output from the Control Plane." />
      <div className="card-grid">
        <Surface><SectionHeader title="Servers" /><p>{serverItems.length}</p></Surface>
        <Surface><SectionHeader title="Disabled" /><p>{serverItems.filter((server) => !server.enabled).length}</p></Surface>
        <Surface><SectionHeader title="Incidents" /><p>{incidentCount}</p></Surface>
        <Surface><SectionHeader title="Published" /><p>{serverItems.filter((server) => server.published).length}</p></Surface>
        <Surface><SectionHeader title="Quarantined" /><p>{serverItems.filter((server) => server.quarantined).length}</p></Surface>
        <Surface><SectionHeader title="Active rollouts" /><p>{rolloutRows.filter((row) => row.activeVersion).length}</p></Surface>
      </div>
      {versionErrors.length > 0 ? <ErrorState title="Rollout versions partially unavailable" message={`${versionErrors.length} server version request(s) failed while building rollout status.`} /> : null}
      <section>
        <SectionHeader title="Server health" description="Rows returned by /api/server-health." />
        {health.ok && healthItems.length > 0 ? <HealthTable checks={healthItems} serverNameById={serverNameById} /> : health.ok ? <EmptyState title="No health checks" description="The Control Plane returned no health checks." /> : <ErrorState message={health.error} />}
      </section>
      <section>
        <SectionHeader title="Rollout and quarantine status" description="Combines /api/servers, /api/servers/:serverId/versions, and /api/server-health so operators can see active versions, rollout freshness, and quarantine state together." />
        {servers.ok && rolloutRows.length > 0 ? <RolloutStatusTable rows={rolloutRows} /> : servers.ok ? <EmptyState title="No rollout rows" description="Register servers before rollout status can be shown." /> : <ErrorState message={servers.error} />}
      </section>
      <section>
        <SectionHeader title="Operational catalog state" description="Server enablement and risk posture for operations review." />
        {servers.ok && serverItems.length > 0 ? <ServerTable servers={serverItems} /> : servers.ok ? <EmptyState title="No servers" description="The Control Plane returned no catalog entries." /> : <ErrorState message={servers.error} />}
      </section>
    </div>
  );
}
