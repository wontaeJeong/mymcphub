import { describe, expect, it } from "vitest";

import { createCatalogRepository, type QueryRows } from "./repositories";
import { readTestDatabaseUrl } from "./test-config";

type RecordedQuery = {
  query: string;
  values?: readonly unknown[];
};

const now = new Date("2026-06-07T00:00:00.000Z");

const echoServerRow = {
  id: "00000000-0000-4000-8000-000000000100",
  slug: "echo",
  display_name: "Echo MCP Server",
  description: "First-party echo server",
  owner_team_id: "00000000-0000-4000-8000-000000000010",
  environment: "dev",
  transport: "streamable_http",
  upstream_url: "http://localhost:5100/mcp",
  enabled: true,
  risk_level: "low",
  created_at: now,
  updated_at: now
} as const;

const activatedAt = new Date("2026-06-07T01:00:00.000Z");

const echoServerVersionRow = {
  id: "00000000-0000-4000-8000-000000000300",
  server_id: echoServerRow.id,
  version: "1.0.0",
  image_ref: "ghcr.io/mcp-hub/echo:1.0.0",
  image_repository: "ghcr.io/mcp-hub/echo",
  image_tag: "1.0.0",
  image_digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  config_hash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  tool_schema_hash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  status: "pending",
  created_by: "00000000-0000-4000-8000-000000000001",
  activated_at: null,
  manifest_json: { schemaVersion: 1 },
  created_at: now
} as const;

describe("catalog repository integration contract", () => {
  it("maps server rows and parameterizes slug lookups", async () => {
    const { queryRows, queries } = createCatalogQueryRecorder();
    const repository = createCatalogRepository(queryRows);

    await expect(repository.listServers()).resolves.toEqual([
      {
        id: echoServerRow.id,
        slug: "echo",
        displayName: "Echo MCP Server",
        description: "First-party echo server",
        ownerTeamId: echoServerRow.owner_team_id,
        environment: "dev",
        transport: "streamable_http",
        upstreamUrl: "http://localhost:5100/mcp",
        enabled: true,
        riskLevel: "low",
        createdAt: now,
        updatedAt: now
      }
    ]);
    await expect(repository.findServerBySlug("echo")).resolves.toMatchObject({ slug: "echo" });
    await expect(repository.findServerBySlug("missing")).resolves.toBeUndefined();

    expect(queries.map((query) => normalizeSql(query.query))).toEqual([
      "select * from mcp_servers order by slug asc",
      "select * from mcp_servers where slug = $1 limit 1",
      "select * from mcp_servers where slug = $1 limit 1"
    ]);
    expect(queries[1]?.values).toEqual(["echo"]);
    expect(queries[2]?.values).toEqual(["missing"]);
  });

  it("records health checks with JSON metadata and nullable optional fields", async () => {
    const { queryRows, queries } = createCatalogQueryRecorder();
    const repository = createCatalogRepository(queryRows);

    await repository.recordHealthCheck({
      serverId: echoServerRow.id,
      status: "degraded",
      errorMessage: "slow upstream",
      metadataJson: { traceId: "trace-db-repository" }
    });

    const [insert] = queries;
    expect(normalizeSql(insert?.query ?? "")).toBe(
      "insert into server_health_checks (server_id, status, latency_ms, error_message, metadata_json) values ($1, $2, $3, $4, $5::jsonb)"
    );
    expect(insert?.values).toEqual([
      echoServerRow.id,
      "degraded",
      null,
      "slow upstream",
      JSON.stringify({ traceId: "trace-db-repository" })
    ]);
  });

  it("lists and creates server versions with release metadata", async () => {
    const { queryRows, queries } = createCatalogQueryRecorder();
    const repository = createCatalogRepository(queryRows);

    await expect(repository.listServerVersions(echoServerRow.id)).resolves.toEqual([
      {
        id: echoServerVersionRow.id,
        serverId: echoServerRow.id,
        version: "1.0.0",
        imageRef: "ghcr.io/mcp-hub/echo:1.0.0",
        imageRepository: "ghcr.io/mcp-hub/echo",
        imageTag: "1.0.0",
        imageDigest: echoServerVersionRow.image_digest,
        configHash: echoServerVersionRow.config_hash,
        toolSchemaHash: echoServerVersionRow.tool_schema_hash,
        status: "pending",
        createdBy: echoServerVersionRow.created_by,
        activatedAt: null,
        manifestJson: { schemaVersion: 1 },
        createdAt: now
      }
    ]);

    await expect(
      repository.createServerVersion({
        serverId: echoServerRow.id,
        version: "1.0.0",
        imageRef: "ghcr.io/mcp-hub/echo:1.0.0",
        imageRepository: "ghcr.io/mcp-hub/echo",
        imageTag: "1.0.0",
        imageDigest: echoServerVersionRow.image_digest,
        configHash: echoServerVersionRow.config_hash,
        toolSchemaHash: echoServerVersionRow.tool_schema_hash,
        status: "pending",
        createdBy: echoServerVersionRow.created_by,
        manifestJson: { schemaVersion: 1 }
      })
    ).resolves.toMatchObject({ version: "1.0.0", status: "pending", imageRepository: "ghcr.io/mcp-hub/echo" });

    expect(queries.map((query) => normalizeSql(query.query))).toEqual([
      "select * from mcp_server_versions where server_id = $1 order by created_at desc, version desc",
      "insert into mcp_server_versions ( server_id, version, image_ref, image_repository, image_tag, image_digest, config_hash, tool_schema_hash, status, created_by, activated_at, manifest_json ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb) returning *"
    ]);
    expect(queries[0]?.values).toEqual([echoServerRow.id]);
    expect(queries[1]?.values).toEqual([
      echoServerRow.id,
      "1.0.0",
      "ghcr.io/mcp-hub/echo:1.0.0",
      "ghcr.io/mcp-hub/echo",
      "1.0.0",
      echoServerVersionRow.image_digest,
      echoServerVersionRow.config_hash,
      echoServerVersionRow.tool_schema_hash,
      "pending",
      echoServerVersionRow.created_by,
      null,
      JSON.stringify({ schemaVersion: 1 })
    ]);
  });

  it("updates server version lifecycle status with parameterized helpers", async () => {
    const { queryRows, queries } = createCatalogQueryRecorder();
    const repository = createCatalogRepository(queryRows);

    await expect(repository.activateServerVersion(echoServerVersionRow.id, activatedAt)).resolves.toMatchObject({
      status: "active",
      activatedAt
    });
    await expect(repository.markServerVersionDeprecated(echoServerVersionRow.id)).resolves.toMatchObject({ status: "deprecated" });
    await expect(repository.markServerVersionRolledBack(echoServerVersionRow.id)).resolves.toMatchObject({ status: "rolled_back" });

    expect(queries.map((query) => normalizeSql(query.query))).toEqual([
      "update mcp_server_versions set status = 'active', activated_at = $2 where id = $1 returning *",
      "update mcp_server_versions set status = 'deprecated' where id = $1 returning *",
      "update mcp_server_versions set status = 'rolled_back' where id = $1 returning *"
    ]);
    expect(queries[0]?.values).toEqual([echoServerVersionRow.id, activatedAt]);
    expect(queries[1]?.values).toEqual([echoServerVersionRow.id]);
    expect(queries[2]?.values).toEqual([echoServerVersionRow.id]);
  });
});

describe("test database configuration", () => {
  it("prefers TEST_DATABASE_URL and keeps it separate from DATABASE_URL", () => {
    const databaseUrl = "postgres://app@example.local/mcp_hub";
    const testDatabaseUrl = "postgres://test@example.local/mcp_hub_test";

    expect(readTestDatabaseUrl({ DATABASE_URL: databaseUrl, TEST_DATABASE_URL: testDatabaseUrl })).toBe(testDatabaseUrl);
    expect(() => readTestDatabaseUrl({ DATABASE_URL: databaseUrl, TEST_DATABASE_URL: databaseUrl })).toThrow("TEST_DATABASE_URL must be separate");
  });

  it("does not fall back to DATABASE_URL when no test database is configured", () => {
    expect(readTestDatabaseUrl({ DATABASE_URL: "postgres://app@example.local/mcp_hub" })).toBeUndefined();
  });
});

function createCatalogQueryRecorder() {
  const queries: RecordedQuery[] = [];
  const queryRows: QueryRows = async <Row>(query: string, values?: readonly unknown[]) => {
    queries.push({ query, values });

    if (query.includes("from mcp_servers where slug")) {
      return values?.[0] === "echo" ? [echoServerRow as Row] : [];
    }
    if (query.includes("from mcp_servers order by")) {
      return [echoServerRow as Row];
    }
    if (query.includes("from mcp_server_versions")) {
      return [echoServerVersionRow as Row];
    }
    if (query.includes("insert into mcp_server_versions")) {
      return [echoServerVersionRow as Row];
    }
    if (query.includes("status = 'active'")) {
      return [{ ...echoServerVersionRow, status: "active", activated_at: values?.[1] } as Row];
    }
    if (query.includes("status = 'deprecated'")) {
      return [{ ...echoServerVersionRow, status: "deprecated" } as Row];
    }
    if (query.includes("status = 'rolled_back'")) {
      return [{ ...echoServerVersionRow, status: "rolled_back" } as Row];
    }

    return [];
  };

  return { queryRows, queries };
}

function normalizeSql(query: string) {
  return query.replace(/\s+/g, " ").trim();
}
