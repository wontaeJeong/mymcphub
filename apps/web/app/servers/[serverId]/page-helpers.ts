import type { ApiAuditEvent, ApiMcpServerVersion, ApiServerHealth } from "../../../lib/api";

export function selectServerHealth(checks: ApiServerHealth[], serverId: string) {
  return checks.find((check) => check.serverId === serverId);
}

export function selectRecentServerAuditEvents(events: ApiAuditEvent[]) {
  return events.slice(0, 1);
}

export function selectActiveServerVersion(versions: ApiMcpServerVersion[]) {
  const activeVersions = versions.filter((version) => version.status === "active");
  return selectNewestServerVersion(activeVersions.length > 0 ? activeVersions : versions);
}

function selectNewestServerVersion(versions: ApiMcpServerVersion[]) {
  return versions.reduce<ApiMcpServerVersion | undefined>((selected, version) => {
    if (!selected) {
      return version;
    }

    return new Date(version.createdAt).getTime() > new Date(selected.createdAt).getTime() ? version : selected;
  }, undefined);
}
