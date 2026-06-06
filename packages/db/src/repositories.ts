import type { HealthStatus, McpServer, RiskLevel, ServerTransport, Environment } from "./domain";

type McpServerRow = {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  owner_team_id: string;
  environment: Environment;
  transport: ServerTransport;
  upstream_url: string | null;
  enabled: boolean;
  risk_level: RiskLevel;
  created_at: Date;
  updated_at: Date;
};

export type QueryRows = <Row>(query: string, values?: readonly unknown[]) => Promise<Row[]>;

export type CreateHealthCheckInput = {
  serverId: string;
  status: HealthStatus;
  latencyMs?: number;
  errorMessage?: string;
  metadataJson?: Record<string, unknown>;
};

export type CatalogRepository = {
  listServers(): Promise<McpServer[]>;
  findServerBySlug(slug: string): Promise<McpServer | undefined>;
  recordHealthCheck(input: CreateHealthCheckInput): Promise<void>;
};

export function createCatalogRepository(queryRows: QueryRows): CatalogRepository {
  return {
    async listServers() {
      const rows = await queryRows<McpServerRow>(
        `select * from mcp_servers order by slug asc`
      );

      return rows.map(mapServerRow);
    },
    async findServerBySlug(slug: string) {
      const rows = await queryRows<McpServerRow>(
        `select * from mcp_servers where slug = $1 limit 1`,
        [slug]
      );

      return rows[0] ? mapServerRow(rows[0]) : undefined;
    },
    async recordHealthCheck(input: CreateHealthCheckInput) {
      await queryRows(
        `insert into server_health_checks (server_id, status, latency_ms, error_message, metadata_json)
         values ($1, $2, $3, $4, $5::jsonb)`,
        [
          input.serverId,
          input.status,
          input.latencyMs ?? null,
          input.errorMessage ?? null,
          JSON.stringify(input.metadataJson ?? {})
        ]
      );
    }
  };
}

function mapServerRow(row: McpServerRow): McpServer {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    description: row.description,
    ownerTeamId: row.owner_team_id,
    environment: row.environment,
    transport: row.transport,
    upstreamUrl: row.upstream_url,
    enabled: row.enabled,
    riskLevel: row.risk_level,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
