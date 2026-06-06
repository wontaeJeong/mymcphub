import { EmptyState } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ServerRegistrationForm } from "../../components/server-registration-form";
import { ErrorState } from "../../components/states";
import { ServerTable } from "../../components/tables";
import type { ApiMcpServer, ApiServerHealth, Environment, RiskLevel, ServerTransport } from "../../lib/api";
import { listServerHealth, listServers } from "../../lib/api";
import { loadResult } from "../../lib/result";

type CatalogPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

type HealthFilter = ApiServerHealth["status"] | "unavailable";

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const filters = await searchParams;
  const serversPromise = loadResult(listServers());
  const healthPromise = loadResult(listServerHealth());
  const [servers, health] = await Promise.all([serversPromise, healthPromise]);
  const healthByServerId = new Map((health.ok ? health.data.items : []).map((check) => [check.serverId, check]));
  const serverItems = servers.ok ? servers.data.items : [];
  const filteredServers = serverItems.filter((server) => matchesCatalogFilters(server, healthByServerId.get(server.id), filters));

  return (
    <div className="page-stack">
      <PageHero eyebrow="MCP server catalog" title="Find the servers worth trusting." description="Browse, filter, and register MCP servers from live Control Plane catalog and health endpoints." />
      <form className="form-card" action="/catalog">
        <h2>Search and filter catalog</h2>
        <p>Filters apply to real /api/servers data, with health joined from /api/server-health when available.</p>
        <div className="filter-grid">
          <div className="field">
            <label htmlFor="catalogSearch">Search</label>
            <input id="catalogSearch" name="q" defaultValue={readFilter(filters, "q")} placeholder="Slug, name, owner, description" />
          </div>
          <div className="field">
            <label htmlFor="catalogEnvironment">Environment</label>
            <select id="catalogEnvironment" name="environment" defaultValue={readFilter(filters, "environment")}>
              <option value="">Any</option>
              <option value="dev">dev</option>
              <option value="stg">stg</option>
              <option value="prod">prod</option>
              <option value="shared">shared</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="catalogTransport">Transport</label>
            <select id="catalogTransport" name="transport" defaultValue={readFilter(filters, "transport")}>
              <option value="">Any</option>
              <option value="streamable_http">streamable_http</option>
              <option value="sse_legacy">sse_legacy</option>
              <option value="stdio_adapter">stdio_adapter</option>
              <option value="external">external</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="catalogRisk">Risk</label>
            <select id="catalogRisk" name="risk" defaultValue={readFilter(filters, "risk")}>
              <option value="">Any</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="catalogHealth">Health</label>
            <select id="catalogHealth" name="health" defaultValue={readFilter(filters, "health")}>
              <option value="">Any</option>
              <option value="healthy">healthy</option>
              <option value="degraded">degraded</option>
              <option value="unhealthy">unhealthy</option>
              <option value="unavailable">unavailable</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="catalogEnabled">Enabled state</label>
            <select id="catalogEnabled" name="enabled" defaultValue={readFilter(filters, "enabled")}>
              <option value="">Any</option>
              <option value="enabled">enabled</option>
              <option value="disabled">disabled</option>
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button className="button" type="submit">Apply filters</button>
          <a className="button button--ghost" href="/catalog">Clear</a>
        </div>
      </form>
      {!health.ok ? <ErrorState title="Health unavailable" message={health.error} /> : null}
      <section>
        <SectionHeader title="Catalog" description="Server listing includes slug, display name, owner team, environment, transport, risk, health, and enabled state." />
        {servers.ok && filteredServers.length > 0 ? <ServerTable servers={filteredServers} healthByServerId={healthByServerId} /> : servers.ok && serverItems.length > 0 ? <EmptyState title="No matching servers" description="The Control Plane returned servers, but none match the selected filters." /> : servers.ok ? <EmptyState title="No servers registered" description="The Control Plane returned an empty catalog. No seed data is injected by the UI." /> : <ErrorState message={servers.error} />}
      </section>
      <ServerRegistrationForm />
    </div>
  );
}

function matchesCatalogFilters(server: ApiMcpServer, health: ApiServerHealth | undefined, filters: Record<string, string | string[] | undefined>) {
  const query = readFilter(filters, "q").toLowerCase();
  const environment = readEnvironmentFilter(filters);
  const transport = readTransportFilter(filters);
  const risk = readRiskFilter(filters);
  const healthStatus = readHealthFilter(filters);
  const enabled = readFilter(filters, "enabled");

  return (!query || [server.slug, server.displayName, server.description, server.ownerTeamId].some((value) => (value ?? "").toLowerCase().includes(query)))
    && (!environment || server.environment === environment)
    && (!transport || server.transport === transport)
    && (!risk || server.riskLevel === risk)
    && (!healthStatus || (health ? health.status : "unavailable") === healthStatus)
    && (!enabled || (enabled === "enabled" ? server.enabled : !server.enabled));
}

function readFilter(filters: Record<string, string | string[] | undefined>, field: string) {
  const value = filters[field];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function readEnvironmentFilter(filters: Record<string, string | string[] | undefined>): Environment | "" {
  const value = readFilter(filters, "environment");
  return value === "dev" || value === "stg" || value === "prod" || value === "shared" ? value : "";
}

function readTransportFilter(filters: Record<string, string | string[] | undefined>): ServerTransport | "" {
  const value = readFilter(filters, "transport");
  return value === "streamable_http" || value === "sse_legacy" || value === "stdio_adapter" || value === "external" ? value : "";
}

function readRiskFilter(filters: Record<string, string | string[] | undefined>): RiskLevel | "" {
  const value = readFilter(filters, "risk");
  return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : "";
}

function readHealthFilter(filters: Record<string, string | string[] | undefined>): HealthFilter | "" {
  const value = readFilter(filters, "health");
  return value === "healthy" || value === "degraded" || value === "unhealthy" || value === "unavailable" ? value : "";
}
