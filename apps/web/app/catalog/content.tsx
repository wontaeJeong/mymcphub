import { EmptyState } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ServerRegistrationForm } from "../../components/server-registration-form";
import { ErrorState } from "../../components/states";
import { ServerTable } from "../../components/tables";
import { listServerHealth, listServers } from "../../lib/api";
import { loadResult } from "../../lib/result";
import { matchesCatalogFilters, readFilter } from "./page-helpers";

type CatalogPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export async function CatalogPageContent({ searchParams, mode }: CatalogPageProps & Readonly<{ mode: "user" | "admin" }>) {
  const filters = await searchParams;
  const serversPromise = loadResult(listServers());
  const healthPromise = loadResult(listServerHealth());
  const [servers, health] = await Promise.all([serversPromise, healthPromise]);
  const healthByServerId = new Map((health.ok ? health.data.items : []).map((check) => [check.serverId, check]));
  const serverItems = servers.ok ? servers.data.items : [];
  const filteredServers = serverItems.filter((server) => matchesCatalogFilters(server, healthByServerId.get(server.id), filters));

  return (
    <div className="page-stack">
      <PageHero eyebrow="Servers" title="Find the servers worth trusting." description={mode === "admin" ? "Browse, filter, and register MCP servers with health and ownership context." : "Browse trusted MCP servers and inspect what they expose before requesting access."} />
      <form className="form-card" action={mode === "admin" ? "/admin/servers" : "/user/catalog"}>
        <h2>Search and filter servers</h2>
        <p>Filter by name, environment, transport, risk, health, and enabled state so the next action is obvious.</p>
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
          <a className="button button--ghost" href={mode === "admin" ? "/admin/servers" : "/user/catalog"}>Clear</a>
        </div>
      </form>
      {!health.ok ? <ErrorState title="Health unavailable" message={health.error} /> : null}
      <section>
        <SectionHeader title="Servers" description="Primary status, risk, health, and owner context are easiest to scan; lower-level identifiers stay in muted metadata." />
        {servers.ok && filteredServers.length > 0 ? <ServerTable servers={filteredServers} healthByServerId={healthByServerId} serverBasePath={mode === "admin" ? "/admin/servers" : "/user/servers"} /> : servers.ok && serverItems.length > 0 ? <EmptyState title="No matching servers" description="No registered server matches the selected filters." /> : servers.ok ? <EmptyState title="No data yet" description="Register the first server to start reviewing tools, grants, operations, and client setup." /> : <ErrorState message={servers.error} />}
      </section>
      {mode === "admin" ? <ServerRegistrationForm /> : null}
    </div>
  );
}
