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

    return [];
  };

  return { queryRows, queries };
}

function normalizeSql(query: string) {
  return query.replace(/\s+/g, " ").trim();
}
