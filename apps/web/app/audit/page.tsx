import Link from "next/link";
import { EmptyState } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { AuditTable, ToolCallTable } from "../../components/tables";
import type { ListAuditEventsOptions } from "../../lib/api";
import { listAuditEvents, listServers, listToolCallEvents } from "../../lib/api";
import { loadResult } from "../../lib/result";

type AuditPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const auditFilterFields = [
  { name: "from", label: "From", placeholder: "2026-06-07T00:00:00Z" },
  { name: "to", label: "To", placeholder: "2026-06-07T23:59:59Z" },
  { name: "user", label: "User", placeholder: "user id" },
  { name: "team", label: "Team", placeholder: "team id" },
  { name: "project", label: "Project", placeholder: "project id" },
  { name: "server", label: "Server", placeholder: "server id" },
  { name: "tool", label: "Tool", placeholder: "tool name" },
  { name: "event_type", label: "Event type", placeholder: "tool.call" },
  { name: "policy_decision", label: "Policy decision", placeholder: "allow, deny, needs_approval" },
  { name: "risk_level", label: "Risk level", placeholder: "low, medium, high, critical" },
  { name: "trace_id", label: "Trace ID", placeholder: "trace id" },
  { name: "limit", label: "Limit", placeholder: "100" },
  { name: "status", label: "Tool call status", placeholder: "ok, failed" }
] as const;

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const filters = await searchParams;
  const auditPromise = loadResult(listAuditEvents(readAuditOptions(filters)));
  const callsPromise = loadResult(listToolCallEvents());
  const serversPromise = loadResult(listServers());
  const [audit, calls, servers] = await Promise.all([auditPromise, callsPromise, serversPromise]);
  const serverNameById = new Map((servers.ok ? servers.data.items : []).map((server) => [server.id, server.displayName]));
  const auditItems = audit.ok ? audit.data.items : [];
  const filteredCalls = calls.ok ? calls.data.items.filter((event) => matchesStringFilter(event.serverId, readFilter(filters, "server")) && matchesStringFilter(event.toolName, readFilter(filters, "tool")) && matchesStringFilter(event.status, readFilter(filters, "status"))) : [];
  const nextAuditHref = audit.ok && audit.data.pageInfo?.nextCursor ? buildAuditPageHref(filters, audit.data.pageInfo.nextCursor) : undefined;

  return (
    <div className="page-stack">
      <PageHero eyebrow="Audit log" title="Trace the decisions that shaped access." description="Render audit events and tool call events from the Control Plane API with server-side audit filters, redacted metadata, and trace-id copy controls." />
      <form className="form-card" action="/audit">
        <h2>Audit filters</h2>
        <p>Audit filters are sent to /api/audit-events. Tool call status remains a Web-only filter for /api/tool-call-events.</p>
        <div className="filter-grid">
          {auditFilterFields.map((field) => (
            <div className="field" key={field.name}>
              <label htmlFor={`filter-${field.name}`}>{field.label}</label>
              <input id={`filter-${field.name}`} name={field.name} defaultValue={field.name === "limit" ? readFilter(filters, field.name) || "100" : readFilter(filters, field.name)} placeholder={field.placeholder} />
            </div>
          ))}
        </div>
        <div className="form-actions">
          <button className="button" type="submit">Apply filters</button>
          <a className="button button--ghost" href="/audit">Clear</a>
        </div>
      </form>
      <section>
        <SectionHeader title="Policy and admin events" description="Paginated /api/audit-events results with server-side filters and redacted argument detail." action={nextAuditHref ? <Link className="button" href={nextAuditHref}>Next page</Link> : undefined} />
        {audit.ok && auditItems.length > 0 ? <AuditTable events={auditItems} /> : audit.ok ? <EmptyState title="No audit events" description="No audit event matched the current server-side filters." /> : <ErrorState message={audit.error} />}
      </section>
      <section>
        <SectionHeader title="Tool call events" description="Operational tool execution records from /api/tool-call-events." />
        {calls.ok && filteredCalls.length > 0 ? <ToolCallTable events={filteredCalls} serverNameById={serverNameById} /> : calls.ok ? <EmptyState title="No tool calls" description="No tool call events matched the current filters." /> : <ErrorState message={calls.error} />}
      </section>
    </div>
  );
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

function readAuditOptions(filters: Record<string, string | string[] | undefined>): ListAuditEventsOptions {
  return {
    limit: readLimitFilter(filters),
    cursor: readFilter(filters, "cursor"),
    from: readFilter(filters, "from"),
    to: readFilter(filters, "to"),
    user: readFilter(filters, "user"),
    team: readFilter(filters, "team"),
    project: readFilter(filters, "project"),
    server: readFilter(filters, "server"),
    tool: readFilter(filters, "tool"),
    event_type: readFilter(filters, "event_type"),
    policy_decision: readFilter(filters, "policy_decision"),
    risk_level: readFilter(filters, "risk_level"),
    trace_id: readFilter(filters, "trace_id")
  };
}

function readLimitFilter(filters: Record<string, string | string[] | undefined>) {
  const parsed = Number.parseInt(readFilter(filters, "limit"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

function buildAuditPageHref(filters: Record<string, string | string[] | undefined>, cursor: string) {
  const params = new URLSearchParams();
  for (const field of auditFilterFields) {
    const value = field.name === "limit" ? readFilter(filters, field.name) || "100" : readFilter(filters, field.name);
    if (value) {
      params.set(field.name, value);
    }
  }
  params.set("cursor", cursor);

  return `/audit?${params.toString()}`;
}
