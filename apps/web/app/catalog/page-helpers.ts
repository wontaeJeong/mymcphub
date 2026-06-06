import type { ApiMcpServer, ApiServerHealth, Environment, RiskLevel, ServerTransport } from "../../lib/api";

type HealthFilter = ApiServerHealth["status"] | "unavailable";

export function matchesCatalogFilters(server: ApiMcpServer, health: ApiServerHealth | undefined, filters: Record<string, string | string[] | undefined>) {
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

export function readFilter(filters: Record<string, string | string[] | undefined>, field: string) {
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
