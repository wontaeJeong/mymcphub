import type { ApiToolCallEvent, ListAuditEventsOptions } from "../../lib/api";

export const auditFilterFields = [
  { name: "from", label: "시작", placeholder: "2026-06-07T00:00:00Z" },
  { name: "to", label: "종료", placeholder: "2026-06-07T23:59:59Z" },
  { name: "user", label: "사용자", placeholder: "사용자 ID" },
  { name: "team", label: "팀", placeholder: "팀 ID" },
  { name: "project", label: "프로젝트", placeholder: "프로젝트 ID" },
  { name: "server", label: "서버", placeholder: "서버 ID" },
  { name: "tool", label: "도구", placeholder: "도구 이름" },
  { name: "event_type", label: "이벤트 유형", placeholder: "tool.call" },
  { name: "policy_decision", label: "정책 결정", placeholder: "allow, deny, needs_approval" },
  { name: "risk_level", label: "위험도", placeholder: "low, medium, high, critical" },
  { name: "trace_id", label: "추적 ID", placeholder: "추적 ID" },
  { name: "limit", label: "제한", placeholder: "100" },
  { name: "status", label: "도구 호출 상태", placeholder: "ok, failed" }
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

export function buildAuditPageHref(filters: Record<string, string | string[] | undefined>, cursor: string) {
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
