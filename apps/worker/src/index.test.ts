import { once } from "node:events";

import { afterEach, describe, expect, it, vi } from "vitest";

import { getWorkerMetricsText, resetWorkerMetricsForTests } from "./metrics.js";
import { createWorkerServer, getWorkerAuditEvents, resetWorkerAuditEventsForTests, runWorkerOnce, type WorkerJob } from "./index.js";

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
      { kind: "schema-diff", targetServerId: "server-1" }
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
