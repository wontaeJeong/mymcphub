import type { ApiToolCallEvent, ListAuditEventsOptions } from "../../lib/api";

export const auditFilterFields = [
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

export function readFilter(filters: Record<string, string | string[] | undefined>, field: string) {
  const value = filters[field];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export function readAuditOptions(filters: Record<string, string | string[] | undefined>): ListAuditEventsOptions {
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

export function filterToolCallEvents(events: ApiToolCallEvent[], filters: Record<string, string | string[] | undefined>) {
  return events.filter((event) => matchesStringFilter(event.serverId, readFilter(filters, "server")) && matchesStringFilter(event.toolName, readFilter(filters, "tool")) && matchesStringFilter(event.status, readFilter(filters, "status")));
}

export function buildAuditPageHref(filters: Record<string, string | string[] | undefined>, cursor: string, basePath = "/admin/audit") {
  const params = new URLSearchParams();
  for (const field of auditFilterFields) {
    const value = field.name === "limit" ? readFilter(filters, field.name) || "100" : readFilter(filters, field.name);
    if (value) {
      params.set(field.name, value);
    }
  }
  params.set("cursor", cursor);

  return `${basePath}?${params.toString()}`;
}

function matchesStringFilter(value: string | undefined, filter: string) {
  if (!filter) {
    return true;
  }

  return (value ?? "").toLowerCase().includes(filter.toLowerCase());
}

function readLimitFilter(filters: Record<string, string | string[] | undefined>) {
  const parsed = Number.parseInt(readFilter(filters, "limit"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}
