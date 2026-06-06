import { EmptyState, Surface } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { HealthTable, ServerTable } from "../../components/tables";
import { listServerHealth, listServers } from "../../lib/api";
import { loadResult } from "../../lib/result";

export default async function OperationsPage() {
  const serversPromise = loadResult(listServers());
  const healthPromise = loadResult(listServerHealth());
  const [servers, health] = await Promise.all([serversPromise, healthPromise]);
  const serverItems = servers.ok ? servers.data.items : [];
  const healthItems = health.ok ? health.data.items : [];
  const serverNameById = new Map(serverItems.map((server) => [server.id, server.displayName]));
  const incidentCount = healthItems.filter((check) => check.status !== "healthy").length;

  return (
    <div className="page-stack">
      <PageHero eyebrow="Health and operations" title="Keep the hub in service." description="Watch server status, disabled catalog entries, and health worker output from the Control Plane." />
      <div className="card-grid">
        <Surface><SectionHeader title="Servers" /><p>{serverItems.length}</p></Surface>
        <Surface><SectionHeader title="Disabled" /><p>{serverItems.filter((server) => !server.enabled).length}</p></Surface>
        <Surface><SectionHeader title="Incidents" /><p>{incidentCount}</p></Surface>
      </div>
      <section>
        <SectionHeader title="Server health" description="Rows returned by /api/server-health." />
        {health.ok && healthItems.length > 0 ? <HealthTable checks={healthItems} serverNameById={serverNameById} /> : health.ok ? <EmptyState title="No health checks" description="The Control Plane returned no health checks." /> : <ErrorState message={health.error} />}
      </section>
      <section>
        <SectionHeader title="Operational catalog state" description="Server enablement and risk posture for operations review." />
        {servers.ok && serverItems.length > 0 ? <ServerTable servers={serverItems} /> : servers.ok ? <EmptyState title="No servers" description="The Control Plane returned no catalog entries." /> : <ErrorState message={servers.error} />}
      </section>
    </div>
  );
}
