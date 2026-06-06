import { describe, expect, it } from "vitest";

import { dbTableNames } from "./schema";
import { seedStatements } from "./seed-data";
import {
  ApprovalRequestSchema,
  CreateMcpServerVersionSchema,
  EmergencyPolicyStateSchema,
  HealthCheckResultSchema,
  McpGrantSchema,
  McpServerManifestSchema,
  PolicyDecisionInputSchema,
  PolicyDecisionResultSchema,
  ServerVersionStatusSchema
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

  it("validates prompt-14 server version release metadata", () => {
    expect(ServerVersionStatusSchema.options).toEqual(["draft", "pending", "active", "deprecated", "rolled_back"]);

    expect(
      CreateMcpServerVersionSchema.parse({
        serverId: "00000000-0000-4000-8000-000000000100",
        version: "1.0.0",
        imageRef: "ghcr.io/mcp-hub/echo:1.0.0",
        imageRepository: "ghcr.io/mcp-hub/echo",
        imageTag: "1.0.0",
        imageDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        configHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        toolSchemaHash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        createdBy: "00000000-0000-4000-8000-000000000001",
        activatedAt: "2026-06-07T01:00:00.000Z",
        manifestJson: { schemaVersion: 1 }
      })
    ).toMatchObject({ status: "draft", imageRepository: "ghcr.io/mcp-hub/echo", manifestJson: { schemaVersion: 1 } });

    expect(
      CreateMcpServerVersionSchema.parse({
        serverId: "00000000-0000-4000-8000-000000000100",
        version: "1.0.1"
      })
    ).toMatchObject({ status: "draft", manifestJson: {} });

    expect(
      CreateMcpServerVersionSchema.safeParse({
        serverId: "00000000-0000-4000-8000-000000000100",
        version: "1.0.0",
        status: "rollback"
      }).success
    ).toBe(false);
  });

  it("validates prompt-08 approval, policy result, and emergency policy inputs", () => {
    expect(
      PolicyDecisionInputSchema.parse({
        subject: {
          type: "user",
          userId: "00000000-0000-4000-8000-000000000001",
          teamIds: ["00000000-0000-4000-8000-000000000010"]
        },
        client: {
          clientId: "local-dev-client",
          clientType: "opencode"
        },
        project: {
          projectId: "00000000-0000-4000-8000-000000000020"
        },
        server: {
          serverId: "00000000-0000-4000-8000-000000000100",
          serverSlug: "echo",
          environment: "dev",
          enabled: true
        },
        tool: {
          name: "echo_message",
          riskLevel: "low",
          enabled: true
        },
        action: "call_tool",
        requestTime: new Date("2026-01-01T00:00:00.000Z").toISOString()
      })
    ).toMatchObject({ action: "call_tool", server: { serverSlug: "echo" } });

    expect(
      ApprovalRequestSchema.parse({
        requesterId: "00000000-0000-4000-8000-000000000001",
        subjectType: "team",
        subjectId: "00000000-0000-4000-8000-000000000010",
        projectId: "00000000-0000-4000-8000-000000000020",
        serverId: "00000000-0000-4000-8000-000000000100",
        requestedTools: ["echo_message"],
        environment: "dev",
        ticketUrl: "https://tickets.example.com/MCP-8",
        reason: "Need access"
      })
    ).toMatchObject({ status: "pending", requestedAction: "call_tool" });

    expect(() =>
      ApprovalRequestSchema.parse({
        requesterId: "00000000-0000-4000-8000-000000000001",
        subjectType: "team",
        subjectId: "00000000-0000-4000-8000-000000000010",
        projectId: "00000000-0000-4000-8000-000000000020",
        serverId: "00000000-0000-4000-8000-000000000100",
        requestedTools: [],
        environment: "dev",
        reason: "Need access"
      })
    ).toThrow();

    expect(() =>
      ApprovalRequestSchema.parse({
        requesterId: "00000000-0000-4000-8000-000000000001",
        subjectType: "team",
        subjectId: "00000000-0000-4000-8000-000000000010",
        projectId: "00000000-0000-4000-8000-000000000020",
        serverId: "00000000-0000-4000-8000-000000000100",
        requestedTools: ["*"],
        environment: "dev",
        reason: "Need access"
      })
    ).toThrow();

    expect(() =>
      ApprovalRequestSchema.parse({
        requesterId: "00000000-0000-4000-8000-000000000001",
        subjectType: "team",
        subjectId: "00000000-0000-4000-8000-000000000010",
        projectId: "00000000-0000-4000-8000-000000000020",
        serverId: "00000000-0000-4000-8000-000000000100",
        requestedTools: ["echo_message"],
        environment: "dev",
        ticketUrl: "javascript:alert(1)",
        reason: "Need access"
      })
    ).toThrow();

    expect(
      ApprovalRequestSchema.safeParse({
        requesterId: "00000000-0000-4000-8000-000000000001",
        subjectType: "team",
        subjectId: "00000000-0000-4000-8000-000000000010",
        projectId: "00000000-0000-4000-8000-000000000020",
        serverId: "00000000-0000-4000-8000-000000000100",
        requestedTools: ["echo_message"],
        environment: "dev",
        ticketUrl: "not a url",
        reason: "Need access"
      }).success
    ).toBe(false);

    expect(
      McpGrantSchema.safeParse({
        subjectType: "team",
        subjectId: "00000000-0000-4000-8000-000000000010",
        projectId: "00000000-0000-4000-8000-000000000020",
        serverId: "00000000-0000-4000-8000-000000000100",
        allowedTools: ["echo_message"],
        environment: "dev",
        ticketUrl: "javascript:alert(1)",
        reason: "Need access"
      }).success
    ).toBe(false);

    expect(
      PolicyDecisionResultSchema.parse({
        allowed: true,
        reason: "Allowed",
        reasonCode: "ALLOW",
        matchedGrantIds: ["grant-1"]
      })
    ).toEqual({ allowed: true, reason: "Allowed", reasonCode: "ALLOW", matchedGrantIds: ["grant-1"] });

    expect(
      EmergencyPolicyStateSchema.parse({
        reason: "Incident",
        global: false,
        highCritical: true,
        serverIds: ["00000000-0000-4000-8000-000000000100"],
        clientIds: ["local-dev-client"]
      })
    ).toMatchObject({ enabled: true, global: false, highCritical: true });
  });

  it("lists required tables and seed statements", () => {
    expect(dbTableNames).toContain("mcp_servers");
    expect(dbTableNames).toContain("audit_events");
    expect(seedStatements.length).toBeGreaterThanOrEqual(6);
    expect(seedStatements.join("\n")).toContain("stdio-sample");
    expect(seedStatements.join("\n")).toContain("stdio_adapter");
  });
});
