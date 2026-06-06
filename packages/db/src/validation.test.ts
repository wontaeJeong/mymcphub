import { describe, expect, it } from "vitest";

import { dbTableNames } from "./schema";
import { seedStatements } from "./seed-data";
import {
  HealthCheckResultSchema,
  McpGrantSchema,
  McpServerManifestSchema
} from "./validation";

describe("db shared schemas", () => {
  it("validates an MCP server manifest", () => {
    const result = McpServerManifestSchema.parse({
      slug: "echo",
      displayName: "Echo MCP Server",
      ownerTeamId: "00000000-0000-4000-8000-000000000010",
      environment: "dev",
      transport: "streamable_http",
      upstreamUrl: "http://localhost:5100/mcp",
      tools: [
        {
          name: "echo",
          inputSchema: { type: "object" }
        }
      ]
    });

    expect(result.slug).toBe("echo");
    expect(result.tools[0]?.enabled).toBe(true);
  });

  it("validates grant and health check inputs", () => {
    expect(
      McpGrantSchema.parse({
        subjectType: "team",
        subjectId: "00000000-0000-4000-8000-000000000010",
        projectId: "00000000-0000-4000-8000-000000000020",
        serverId: "00000000-0000-4000-8000-000000000100",
        allowedTools: ["echo"],
        environment: "dev",
        reason: "Local development"
      }).enabled
    ).toBe(true);

    expect(
      HealthCheckResultSchema.parse({
        serverId: "00000000-0000-4000-8000-000000000100",
        status: "healthy",
        checkedAt: new Date("2026-01-01T00:00:00.000Z").toISOString()
      }).metadataJson
    ).toEqual({});
  });

  it("lists required tables and seed statements", () => {
    expect(dbTableNames).toContain("mcp_servers");
    expect(dbTableNames).toContain("audit_events");
    expect(seedStatements.length).toBeGreaterThanOrEqual(6);
  });
});
