import type {
  Environment,
  HealthStatus,
  McpServer,
  McpServerVersion,
  RiskLevel,
  ServerTransport,
  ServerVersionStatus
} from "./domain";

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

type McpServerVersionRow = {
  id: string;
  server_id: string;
  version: string;
  image_ref: string | null;
  image_repository: string | null;
  image_tag: string | null;
  image_digest: string | null;
  config_hash: string | null;
  tool_schema_hash: string | null;
  status: ServerVersionStatus;
  created_by: string | null;
  activated_at: Date | null;
  manifest_json: Record<string, unknown>;
  created_at: Date;
};

export type QueryRows = <Row>(query: string, values?: readonly unknown[]) => Promise<Row[]>;

export type CreateHealthCheckInput = {
  serverId: string;
  status: HealthStatus;
  latencyMs?: number;
  errorMessage?: string;
  metadataJson?: Record<string, unknown>;
};

export type CreateServerVersionInput = {
  serverId: string;
  version: string;
  imageRef?: string | null;
  imageRepository?: string | null;
  imageTag?: string | null;
  imageDigest?: string | null;
  configHash?: string | null;
  toolSchemaHash?: string | null;
  status?: ServerVersionStatus;
  createdBy?: string | null;
  activatedAt?: Date | null;
  manifestJson?: Record<string, unknown>;
};

export type CatalogRepository = {
  listServers(): Promise<McpServer[]>;
  findServerBySlug(slug: string): Promise<McpServer | undefined>;
  listServerVersions(serverId: string): Promise<McpServerVersion[]>;
  createServerVersion(input: CreateServerVersionInput): Promise<McpServerVersion>;
  activateServerVersion(versionId: string, activatedAt?: Date): Promise<McpServerVersion | undefined>;
  markServerVersionDeprecated(versionId: string): Promise<McpServerVersion | undefined>;
  markServerVersionRolledBack(versionId: string): Promise<McpServerVersion | undefined>;
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
    async listServerVersions(serverId: string) {
      const rows = await queryRows<McpServerVersionRow>(
        `select * from mcp_server_versions where server_id = $1 order by created_at desc, version desc`,
        [serverId]
      );

      return rows.map(mapServerVersionRow);
    },
    async createServerVersion(input: CreateServerVersionInput) {
      const rows = await queryRows<McpServerVersionRow>(
        `insert into mcp_server_versions (
           server_id,
           version,
           image_ref,
           image_repository,
           image_tag,
           image_digest,
           config_hash,
           tool_schema_hash,
           status,
           created_by,
           activated_at,
           manifest_json
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
         returning *`,
        [
          input.serverId,
          input.version,
          input.imageRef ?? null,
          input.imageRepository ?? null,
          input.imageTag ?? null,
          input.imageDigest ?? null,
          input.configHash ?? null,
          input.toolSchemaHash ?? null,
          input.status ?? "draft",
          input.createdBy ?? null,
          input.activatedAt ?? null,
          JSON.stringify(input.manifestJson ?? {})
        ]
      );

      return mapRequiredServerVersionRow(rows[0]);
    },
    async activateServerVersion(versionId: string, activatedAt = new Date()) {
      const rows = await queryRows<McpServerVersionRow>(
        `update mcp_server_versions set status = 'active', activated_at = $2 where id = $1 returning *`,
        [versionId, activatedAt]
      );

      return rows[0] ? mapServerVersionRow(rows[0]) : undefined;
    },
    async markServerVersionDeprecated(versionId: string) {
      const rows = await queryRows<McpServerVersionRow>(
        `update mcp_server_versions set status = 'deprecated' where id = $1 returning *`,
        [versionId]
      );

      return rows[0] ? mapServerVersionRow(rows[0]) : undefined;
    },
    async markServerVersionRolledBack(versionId: string) {
      const rows = await queryRows<McpServerVersionRow>(
        `update mcp_server_versions set status = 'rolled_back' where id = $1 returning *`,
        [versionId]
      );

      return rows[0] ? mapServerVersionRow(rows[0]) : undefined;
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

function mapServerVersionRow(row: McpServerVersionRow): McpServerVersion {
  return {
    id: row.id,
    serverId: row.server_id,
    version: row.version,
    imageRef: row.image_ref,
    imageRepository: row.image_repository,
    imageTag: row.image_tag,
    imageDigest: row.image_digest,
    configHash: row.config_hash,
    toolSchemaHash: row.tool_schema_hash,
    status: row.status,
    createdBy: row.created_by,
    activatedAt: row.activated_at,
    manifestJson: row.manifest_json,
    createdAt: row.created_at
  };
}

function mapRequiredServerVersionRow(row: McpServerVersionRow | undefined): McpServerVersion {
  if (!row) {
    throw new Error("Expected mcp_server_versions insert to return a row");
  }

  return mapServerVersionRow(row);
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
