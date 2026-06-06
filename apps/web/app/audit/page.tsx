import { EmptyState } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { AuditTable, ToolCallTable } from "../../components/tables";
import type { ApiAuditEvent } from "../../lib/api";
import { listAuditEvents, listServers, listToolCallEvents } from "../../lib/api";
import { loadResult } from "../../lib/result";

type AuditPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const filterFields = ["user", "team", "project", "server", "tool", "method", "status", "risk"] as const;

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const filters = await searchParams;
  const auditPromise = loadResult(listAuditEvents(100));
  const callsPromise = loadResult(listToolCallEvents());
  const serversPromise = loadResult(listServers());
  const [audit, calls, servers] = await Promise.all([auditPromise, callsPromise, serversPromise]);
  const serverNameById = new Map((servers.ok ? servers.data.items : []).map((server) => [server.id, server.displayName]));
  const filteredAudit = audit.ok ? audit.data.items.filter((event) => matchesFilters(event, filters)) : [];
  const filteredCalls = calls.ok ? calls.data.items.filter((event) => matchesStringFilter(event.serverId, readFilter(filters, "server")) && matchesStringFilter(event.toolName, readFilter(filters, "tool")) && matchesStringFilter(event.status, readFilter(filters, "status"))) : [];

  return (
    <div className="page-stack">
      <PageHero eyebrow="Audit log" title="Trace the decisions that shaped access." description="Render audit events and tool call events from the Control Plane API with UI filters, redacted metadata, and trace-id copy controls." />
      <form className="form-card" action="/audit">
        <h2>Audit filters</h2>
        <p>Filters are applied in the Web UI to the fetched /api/audit-events and /api/tool-call-events windows.</p>
        <div className="filter-grid">
          {filterFields.map((field) => (
            <div className="field" key={field}>
              <label htmlFor={`filter-${field}`}>{field === "method" ? "Method / event" : field}</label>
              <input id={`filter-${field}`} name={field} defaultValue={readFilter(filters, field)} placeholder={field === "status" ? "deny, allow, ok, failed" : "Contains..."} />
            </div>
          ))}
        </div>
        <div className="form-actions">
          <button className="button" type="submit">Apply filters</button>
          <a className="button button--ghost" href="/audit">Clear</a>
        </div>
      </form>
      <section>
        <SectionHeader title="Policy and admin events" description="Paginated /api/audit-events results with redacted metadata only." />
        {audit.ok && filteredAudit.length > 0 ? <AuditTable events={filteredAudit} /> : audit.ok ? <EmptyState title="No audit events" description="No fetched audit event matched the current filters." /> : <ErrorState message={audit.error} />}
      </section>
      <section>
        <SectionHeader title="Tool call events" description="Operational tool execution records from /api/tool-call-events." />
        {calls.ok && filteredCalls.length > 0 ? <ToolCallTable events={filteredCalls} serverNameById={serverNameById} /> : calls.ok ? <EmptyState title="No tool calls" description="No tool call events matched the current filters." /> : <ErrorState message={calls.error} />}
      </section>
    </div>
  );
}

function matchesFilters(event: ApiAuditEvent, filters: Record<string, string | string[] | undefined>) {
  return matchesStringFilter(event.userId, readFilter(filters, "user"))
    && matchesStringFilter(event.teamId, readFilter(filters, "team"))
    && matchesStringFilter(event.projectId, readFilter(filters, "project"))
    && matchesStringFilter(event.serverId, readFilter(filters, "server"))
    && matchesStringFilter(event.toolName, readFilter(filters, "tool"))
    && matchesStringFilter(event.eventType, readFilter(filters, "method"))
    && matchesStringFilter(event.policyDecision, readFilter(filters, "status"))
    && matchesStringFilter(event.riskLevel, readFilter(filters, "risk"));
}

function matchesStringFilter(value: string | undefined, filter: string) {
  if (!filter) {
    return true;
  }

  return (value ?? "").toLowerCase().includes(filter.toLowerCase());
}

function readFilter(filters: Record<string, string | string[] | undefined>, field: string) {
  const value = filters[field];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}
