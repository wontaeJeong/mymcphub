import type { ApiAuditEvent, ApiServerHealth } from "../../../lib/api";

export function selectServerHealth(checks: ApiServerHealth[], serverId: string) {
  return checks.find((check) => check.serverId === serverId);
}

export function selectRecentServerAuditEvents(events: ApiAuditEvent[]) {
  return events.slice(0, 1);
}
