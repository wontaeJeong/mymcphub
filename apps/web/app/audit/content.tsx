import Link from "next/link";
import { EmptyState } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { AuditTable, ToolCallTable } from "../../components/tables";
import { buildAuditExportPath, getApiBaseUrl, listAuditEvents, listServers, listToolCallEvents } from "../../lib/api";
import { loadResult } from "../../lib/result";
import { auditFilterFields, buildAuditPageHref, filterToolCallEvents, readAuditOptions, readFilter } from "./page-helpers";

type AuditPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export async function AuditPageContent({ searchParams }: AuditPageProps) {
  const filters = await searchParams;
  const auditOptions = readAuditOptions(filters);
  const auditPromise = loadResult(listAuditEvents(auditOptions));
  const callsPromise = loadResult(listToolCallEvents());
  const serversPromise = loadResult(listServers());
  const [audit, calls, servers] = await Promise.all([auditPromise, callsPromise, serversPromise]);
  const serverNameById = new Map((servers.ok ? servers.data.items : []).map((server) => [server.id, server.displayName]));
  const auditItems = audit.ok ? audit.data.items : [];
  const filteredCalls = calls.ok ? filterToolCallEvents(calls.data.items, filters) : [];
  const nextAuditHref = audit.ok && audit.data.pageInfo?.nextCursor ? buildAuditPageHref(filters, audit.data.pageInfo.nextCursor, "/admin/audit") : undefined;
  const exportHref = new URL(buildAuditExportPath(auditOptions), getApiBaseUrl()).toString();

  return (
    <div className="page-stack">
      <PageHero eyebrow="Audit log" title="Trace the decisions that shaped access." description="Render audit events and tool call events from the Control Plane API with server-side audit filters, redacted metadata, and trace-id copy controls." />
      <form className="form-card" action="/admin/audit">
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
          <a className="button button--ghost" href="/admin/audit">Clear</a>
        </div>
      </form>
      <section>
        <SectionHeader title="Policy and admin events" description="Paginated /api/audit-events results with server-side filters and redacted argument detail." action={<div className="actions"><a className="button button--ghost" href={exportHref}>Export filtered JSON</a>{nextAuditHref ? <Link className="button" href={nextAuditHref}>Next page</Link> : null}</div>} />
        {audit.ok && auditItems.length > 0 ? <AuditTable events={auditItems} /> : audit.ok ? <EmptyState title="No audit events" description="No audit event matched the current server-side filters." /> : <ErrorState message={audit.error} />}
      </section>
      <section>
        <SectionHeader title="Tool call events" description="Operational tool execution records from /api/tool-call-events." />
        {calls.ok && filteredCalls.length > 0 ? <ToolCallTable events={filteredCalls} serverNameById={serverNameById} /> : calls.ok ? <EmptyState title="No tool calls" description="No tool call events matched the current filters." /> : <ErrorState message={calls.error} />}
      </section>
    </div>
  );
}
