import { once } from "node:events";

import { afterEach, describe, expect, it, vi } from "vitest";

import { getWorkerMetricsText, resetWorkerMetricsForTests } from "./metrics.js";
import { createWorkerServer, getWorkerAuditEvents, resetWorkerAuditEventsForTests, runWorkerOnce, type WorkerJob } from "./index.js";
import { diffToolSnapshots, hashCanonicalJson, type ToolSnapshot } from "./schema-diff.js";

const { withSpanMock } = vi.hoisted(() => ({
  withSpanMock: vi.fn(async <T>(_service: string, _spanName: string, _attributes: Record<string, string>, fn: () => T | Promise<T>) => fn())
}));

vi.mock("@mcp-hub/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }),
  withSpan: withSpanMock
}));

afterEach(() => {
  resetWorkerMetricsForTests();
  resetWorkerAuditEventsForTests();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("runWorkerOnce", () => {
  it("preserves processed count and returns the supplied trace ID", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const jobs: WorkerJob[] = [
      { kind: "tool-scan", targetServerId: "server-1" },
      { kind: "health-check", targetServerId: "server-2" }
    ];

    const result = await runWorkerOnce(jobs, { traceId: "trace-123" });

    expect(result).toMatchObject({
      processed: 2,
      supportedJobs: ["tool-scan", "schema-diff", "health-check"],
      traceId: "trace-123"
    });
    expect(withSpanMock).toHaveBeenCalledWith("worker", "mcp.worker.tool_scan", { job_kind: "tool-scan" }, expect.any(Function));
    expect(withSpanMock).toHaveBeenCalledWith("worker", "mcp.worker.health_check", { job_kind: "health-check" }, expect.any(Function));
  });

  it("generates a trace ID when absent", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const result = await runWorkerOnce();

    expect(result.traceId).toEqual(expect.any(String));
    expect(result.traceId.length).toBeGreaterThan(0);
  });

  it("increments scan metrics and schema change metrics", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runWorkerOnce([
      { kind: "tool-scan", targetServerId: "server-1" },
      {
        kind: "schema-diff",
        targetServerId: "server-1",
        previousSnapshot: [makeToolSnapshot({ name: "search" })],
        currentSnapshot: [makeToolSnapshot({ name: "search", description: "updated search" })]
      }
    ], { traceId: "trace-metrics" });

    const metrics = await getWorkerMetricsText();

    expect(metrics).toContain("mcp_worker_scan_total");
    expect(metrics).toContain("mcp_worker_scan_total{job_kind=\"tool-scan\",outcome=\"success\"} 1");
    expect(metrics).toContain("mcp_worker_schema_changes_total{job_kind=\"schema-diff\",outcome=\"success\"} 1");
  });

  it("records trace-preserving audit events for schema and health changes", async () => {
    await runWorkerOnce([
      { kind: "schema-diff", targetServerId: "server-schema" },
      { kind: "health-check", targetServerId: "server-health" }
    ], { traceId: "trace-audit" });

    expect(getWorkerAuditEvents()).toEqual([
      expect.objectContaining({ eventType: "health.changed", traceId: "trace-audit", serverId: "server-health", outcome: "success" }),
      expect.objectContaining({ eventType: "schema.changed", traceId: "trace-audit", serverId: "server-schema", outcome: "success" })
    ]);
  });

  it("records supplied snapshot schema diff metadata", async () => {
    await runWorkerOnce([
      {
        kind: "schema-diff",
        targetServerId: "server-schema",
        previousSnapshot: [makeToolSnapshot({ name: "search", risk: "medium" })],
        currentSnapshot: [makeToolSnapshot({ name: "search", risk: "high" })]
      }
    ], { traceId: "trace-schema-diff" });

    expect(getWorkerAuditEvents()).toEqual([
      expect.objectContaining({
        eventType: "schema.changed",
        traceId: "trace-schema-diff",
        serverId: "server-schema",
        metadata: expect.objectContaining({
          approvalRequired: true,
          changed: true,
          diffCount: 1,
          diffTypes: "tool_risk_changed",
          jobKind: "schema-diff"
        })
      })
    ]);
  });

  it("records placeholder schema diff metadata when snapshots are absent", async () => {
    await runWorkerOnce([{ kind: "schema-diff", targetServerId: "server-schema" }], { traceId: "trace-placeholder" });

    expect(getWorkerAuditEvents()).toEqual([
      expect.objectContaining({
        eventType: "schema.changed",
        traceId: "trace-placeholder",
        serverId: "server-schema",
        metadata: expect.objectContaining({
          jobKind: "schema-diff",
          placeholder: true,
          reason: "runtime MCP tools/list scanning is not implemented"
        })
      })
    ]);
  });

  it("serves worker metrics through createWorkerServer", async () => {
    await runWorkerOnce([{ kind: "schema-diff", targetServerId: "server-1" }], { traceId: "trace-server-metrics" });
    const { server } = createWorkerServer();
    server.listen(0);
    await once(server, "listening");

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Worker test server did not bind to a TCP port.");
    }
    const response = await fetch(`http://127.0.0.1:${address.port}/metrics`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toContain("mcp_worker_schema_changes_total");

    server.close();
    await once(server, "close");
  });
});

describe("schema diff helper", () => {
  it("detects added, removed, description, input schema, and risk changes", () => {
    const diffs = diffToolSnapshots([
      makeToolSnapshot({ name: "description-tool", description: "old description" }),
      makeToolSnapshot({ name: "input-tool", inputSchema: { type: "object", properties: { query: { type: "string" } } } }),
      makeToolSnapshot({ name: "removed-tool" }),
      makeToolSnapshot({ name: "risk-tool", risk: "medium" })
    ], [
      makeToolSnapshot({ name: "added-tool" }),
      makeToolSnapshot({ name: "description-tool", description: "new description" }),
      makeToolSnapshot({ name: "input-tool", inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } } } }),
      makeToolSnapshot({ name: "risk-tool", risk: "high" })
    ]);

    expect(diffs.map((diff) => diff.type)).toEqual([
      "tool_added",
      "tool_description_changed",
      "tool_input_schema_changed",
      "tool_removed",
      "tool_risk_changed"
    ]);
    expect(diffs.find((diff) => diff.type === "tool_removed")?.metadata).toMatchObject({ approvalRequired: true, highRisk: true });
    expect(diffs.find((diff) => diff.type === "tool_input_schema_changed")?.metadata).toMatchObject({ approvalRequired: true, highRisk: true });
    expect(diffs.find((diff) => diff.type === "tool_risk_changed")?.metadata).toMatchObject({ approvalRequired: true, highRisk: true });
    expect(diffs.find((diff) => diff.type === "tool_description_changed")?.metadata).toMatchObject({ approvalRequired: false, highRisk: false });
  });

  it("uses canonical JSON hashing for reordered input schema object keys", () => {
    const leftHash = hashCanonicalJson({
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { default: 10, type: "number" }
      },
      required: ["query"]
    });
    const rightHash = hashCanonicalJson({
      required: ["query"],
      properties: {
        limit: { type: "number", default: 10 },
        query: { description: "Search query", type: "string" }
      },
      type: "object"
    });

    expect(leftHash).toBe(rightHash);
  });

  it("requires approval for added high or critical risk tools", () => {
    expect(diffToolSnapshots([], [makeToolSnapshot({ name: "low-tool", risk: "low" })])[0]?.metadata.approvalRequired).toBe(false);
    expect(diffToolSnapshots([], [makeToolSnapshot({ name: "high-tool", risk: "high" })])[0]?.metadata).toMatchObject({
      approvalRequired: true,
      highRisk: true
    });
    expect(diffToolSnapshots([], [makeToolSnapshot({ name: "critical-tool", risk: "critical" })])[0]?.metadata).toMatchObject({
      approvalRequired: true,
      highRisk: true
    });
  });
});

function makeToolSnapshot(overrides: Partial<ToolSnapshot>): ToolSnapshot {
  return {
    name: "search",
    description: "Search documents",
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    risk: "low",
    ...overrides
  };
}
