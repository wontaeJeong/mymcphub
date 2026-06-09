import type {
  ApiGrant,
  ApiMcpServer,
  ApiServerHealth,
  AuthContext,
  Environment,
  MarketCategory,
  MarketTrustLevel,
  MarketVisibility,
  RiskLevel,
  ServerTransport,
} from "../../lib/api";

type HealthFilter = ApiServerHealth["status"] | "unavailable";
type AccessFilter = "accessible" | "request_required";
type TrustFilter = MarketTrustLevel | "verified_only";
type VisibilityFilter = MarketVisibility | "all";

export type CatalogFilterOptions = Readonly<{
  accessByServerId?: ReadonlyMap<string, boolean>;
  defaultEnabledOnly?: boolean;
  defaultVisibleOnly?: boolean;
}>;

export type MarketSummary = Readonly<{
  publishedActiveServers: number;
  accessibleServers: number;
  requestRequiredServers: number;
  statusIssueServers: number;
}>;

export type MarketSections = Readonly<{
  verified: ApiMcpServer[];
  recent: ApiMcpServer[];
  accessible: ApiMcpServer[];
  requestRequired: ApiMcpServer[];
}>;

const verifiedTrustLevels = new Set<MarketTrustLevel>([
  "verified",
  "official",
  "platform_supported",
]);

const defaultVisibleVisibilities = new Set<MarketVisibility>([
  "internal",
  "published",
]);

export function matchesCatalogFilters(
  server: ApiMcpServer,
  health: ApiServerHealth | undefined,
  filters: Record<string, string | string[] | undefined>,
  options: CatalogFilterOptions = {},
) {
  const query = readFilter(filters, "q").toLowerCase();
  const category = readCategoryFilter(filters);
  const tag = readFilter(filters, "tag").toLowerCase();
  const environment = readEnvironmentFilter(filters);
  const transport = readTransportFilter(filters);
  const risk = readRiskFilter(filters);
  const healthStatus = readHealthFilter(filters);
  const trust = readTrustFilter(filters);
  const access = readAccessFilter(filters);
  const visibility = readVisibilityFilter(filters);
  const enabled = readFilter(filters, "enabled");

  return (!query || searchableValues(server).some((value) => value.toLowerCase().includes(query)))
    && (!category || getMarketCategory(server) === category)
    && (!tag || getMarketTags(server).some((value) => value.toLowerCase().includes(tag)))
    && (!environment || server.environment === environment)
    && (!transport || server.transport === transport)
    && (!risk || server.riskLevel === risk)
    && (!healthStatus || (health ? health.status : "unavailable") === healthStatus)
    && matchesTrustFilter(server, trust)
    && matchesAccessFilter(server, access, options.accessByServerId)
    && matchesVisibilityFilter(server, visibility, options.defaultVisibleOnly === true)
    && matchesEnabledFilter(server, enabled, options.defaultEnabledOnly === true);
}

export function readFilter(filters: Record<string, string | string[] | undefined>, field: string) {
  const value = filters[field];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export function getMarketCategory(server: ApiMcpServer): MarketCategory {
  return server.category ?? "other";
}

export function getMarketSummary(server: ApiMcpServer) {
  return server.summary ?? server.description ?? "공개된 요약이 아직 없습니다.";
}

export function getMarketTags(server: ApiMcpServer) {
  return (server.tags ?? []).filter((tag) => tag.trim().length > 0);
}

export function getMarketTrustLevel(server: ApiMcpServer): MarketTrustLevel {
  return server.trustLevel ?? "community";
}

export function getMarketVisibility(server: ApiMcpServer): MarketVisibility {
  if (server.quarantined || server.visibility === "quarantined") {
    return "quarantined";
  }

  if (server.visibility) {
    return server.visibility;
  }

  if (server.published === true) {
    return "published";
  }

  if (server.published === false) {
    return "hidden";
  }

  return "internal";
}

export function isDefaultMarketVisible(server: ApiMcpServer) {
  return server.published !== false
    && !server.quarantined
    && defaultVisibleVisibilities.has(getMarketVisibility(server));
}

export function isVerifiedMarketServer(server: ApiMcpServer) {
  return verifiedTrustLevels.has(getMarketTrustLevel(server));
}

export function isServerAccessible(server: ApiMcpServer, accessByServerId: ReadonlyMap<string, boolean> | undefined) {
  return accessByServerId?.get(server.id) === true;
}

export function buildServerAccessMap(servers: ApiMcpServer[], grants: ApiGrant[], principal: AuthContext | undefined) {
  const subjectIds = buildPrincipalSubjectIds(principal);
  return new Map(
    servers.map((server) => [
      server.id,
      grants.some((grant) => grant.enabled
        && grant.serverId === server.id
        && grant.environment === server.environment
        && subjectIds.has(grant.subjectId)),
    ]),
  );
}

export function buildPrincipalSubjectIds(principal: AuthContext | undefined) {
  if (!principal) {
    return new Set<string>();
  }

  return new Set([
    principal.userId,
    principal.clientId,
    ...principal.teamIds,
    ...principal.teams,
    ...principal.groups,
  ].filter((value) => value.length > 0));
}

export function buildMarketSummary(
  servers: ApiMcpServer[],
  healthByServerId: ReadonlyMap<string, ApiServerHealth> | undefined,
  accessByServerId: ReadonlyMap<string, boolean> | undefined,
): MarketSummary {
  const marketServers = defaultMarketServers(servers);
  const accessibleServers = marketServers.filter((server) => isServerAccessible(server, accessByServerId)).length;
  const statusIssueServers = healthByServerId
    ? marketServers.filter((server) => {
      const health = healthByServerId.get(server.id);
      return !health || health.status !== "healthy";
    }).length
    : 0;

  return {
    publishedActiveServers: marketServers.length,
    accessibleServers,
    requestRequiredServers: marketServers.length - accessibleServers,
    statusIssueServers,
  };
}

export function buildMarketSections(
  servers: ApiMcpServer[],
  accessByServerId: ReadonlyMap<string, boolean> | undefined,
): MarketSections {
  const marketServers = defaultMarketServers(servers);
  return {
    verified: marketServers.filter(isVerifiedMarketServer),
    recent: [...marketServers].sort(compareRecentlyPublished),
    accessible: marketServers.filter((server) => isServerAccessible(server, accessByServerId)),
    requestRequired: marketServers.filter((server) => !isServerAccessible(server, accessByServerId)),
  };
}

function defaultMarketServers(servers: ApiMcpServer[]) {
  return servers.filter((server) => server.enabled && isDefaultMarketVisible(server));
}

function compareRecentlyPublished(left: ApiMcpServer, right: ApiMcpServer) {
  return marketTimestamp(right) - marketTimestamp(left);
}

function marketTimestamp(server: ApiMcpServer) {
  const timestamp = Date.parse(server.publishedAt ?? server.createdAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function searchableValues(server: ApiMcpServer) {
  return [
    server.slug,
    server.displayName,
    server.description ?? "",
    server.ownerTeamId,
    getMarketCategory(server),
    getMarketSummary(server),
    getMarketTrustLevel(server),
    getMarketVisibility(server),
    ...getMarketTags(server),
    ...(server.useCases ?? []),
  ];
}

function matchesTrustFilter(server: ApiMcpServer, trust: TrustFilter | "") {
  if (!trust) {
    return true;
  }

  if (trust === "verified_only") {
    return isVerifiedMarketServer(server);
  }

  return getMarketTrustLevel(server) === trust;
}

function matchesAccessFilter(
  server: ApiMcpServer,
  access: AccessFilter | "",
  accessByServerId: ReadonlyMap<string, boolean> | undefined,
) {
  if (!access) {
    return true;
  }

  const accessible = isServerAccessible(server, accessByServerId);
  return access === "accessible" ? accessible : !accessible;
}

function matchesVisibilityFilter(server: ApiMcpServer, visibility: VisibilityFilter | "", defaultVisibleOnly: boolean) {
  if (visibility === "all") {
    return true;
  }

  if (visibility) {
    return getMarketVisibility(server) === visibility;
  }

  return defaultVisibleOnly ? isDefaultMarketVisible(server) : true;
}

function matchesEnabledFilter(server: ApiMcpServer, enabled: string, defaultEnabledOnly: boolean) {
  if (enabled === "enabled") {
    return server.enabled;
  }

  if (enabled === "disabled") {
    return !server.enabled;
  }

  return defaultEnabledOnly ? server.enabled : true;
}

function readCategoryFilter(filters: Record<string, string | string[] | undefined>): MarketCategory | "" {
  const value = readFilter(filters, "category");
  if (value === "developer_tools"
    || value === "api_development"
    || value === "data_database"
    || value === "cloud_infra"
    || value === "observability"
    || value === "security_testing"
    || value === "knowledge_docs"
    || value === "productivity_workflow"
    || value === "browser_automation"
    || value === "design_tools"
    || value === "other") {
    return value;
  }

  return "";
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

function readTrustFilter(filters: Record<string, string | string[] | undefined>): TrustFilter | "" {
  const value = readFilter(filters, "trust");
  if (value === "community"
    || value === "verified"
    || value === "official"
    || value === "platform_supported"
    || value === "verified_only") {
    return value;
  }

  return "";
}

function readAccessFilter(filters: Record<string, string | string[] | undefined>): AccessFilter | "" {
  const value = readFilter(filters, "access");
  return value === "accessible" || value === "request_required" ? value : "";
}

function readVisibilityFilter(filters: Record<string, string | string[] | undefined>): VisibilityFilter | "" {
  const value = readFilter(filters, "visibility");
  if (value === "draft"
    || value === "internal"
    || value === "published"
    || value === "hidden"
    || value === "quarantined"
    || value === "all") {
    return value;
  }

  return "";
}
