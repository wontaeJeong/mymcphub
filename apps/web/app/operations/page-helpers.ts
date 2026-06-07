import type { ApiMcpServer, ApiMcpServerVersion, ApiServerHealth } from "../../lib/api";
import type { RolloutStatusRow } from "../../components/tables";

export function buildRolloutStatusRows(servers: ApiMcpServer[], versionsByServerId: Map<string, ApiMcpServerVersion[]>, healthByServerId: Map<string, ApiServerHealth>): RolloutStatusRow[] {
  return servers.map((server) => {
    const versions = versionsByServerId.get(server.id) ?? [];
    return {
      server,
      activeVersion: selectActiveVersion(versions),
      latestVersion: selectLatestVersion(versions),
      health: healthByServerId.get(server.id)
    };
  });
}

export function selectActiveVersion(versions: ApiMcpServerVersion[]) {
  return selectLatestVersion(versions.filter((version) => version.status === "active"));
}

export function selectLatestVersion(versions: ApiMcpServerVersion[]) {
  return versions.reduce<ApiMcpServerVersion | undefined>((selected, version) => {
    if (!selected) {
      return version;
    }

    return new Date(version.createdAt).getTime() > new Date(selected.createdAt).getTime() ? version : selected;
  }, undefined);
}
