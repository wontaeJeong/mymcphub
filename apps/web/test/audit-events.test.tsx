import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AuditTable } from "../components/tables";
import type { ApiAuditEvent } from "../lib/api";
import { buildAuditEventsPath } from "../lib/api";

describe("audit events", () => {
  it("renders redacted argument JSON without leaking raw secret values", () => {
    const event: ApiAuditEvent = {
      id: "audit-1",
      timestamp: "2026-06-07T12:00:00.000Z",
      userId: "user-1",
      serverId: "server-1",
      toolName: "deploy.release",
      eventType: "tool.call",
      riskLevel: "high",
      policyDecision: "allow",
      traceId: "trace-1",
      metadataJson: {
        visible: "kept",
        authorization: "raw-secret-value"
      },
      argumentHash: "sha256:abc123",
      argumentRedactedJson: {
        message: "safe value",
        token: "[REDACTED]",
        nested: {
          password: "raw-secret-value"
        }
      },
      latencyMs: 42,
      upstreamStatus: 200
    };

    const html = renderToStaticMarkup(<AuditTable events={[event]} />);

    expect(html).toContain("[REDACTED]");
    expect(html).not.toContain("raw-secret-value");
  });

  it("builds audit-events URLs with server-side query filters", () => {
    const path = buildAuditEventsPath({
      trace_id: "trace-123",
      event_type: "tool.call",
      limit: 25,
      cursor: "cursor-1"
    });
    const url = new URL(path, "http://localhost");

    expect(url.pathname).toBe("/api/audit-events");
    expect(url.searchParams.get("trace_id")).toBe("trace-123");
    expect(url.searchParams.get("event_type")).toBe("tool.call");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.searchParams.get("cursor")).toBe("cursor-1");
  });
});
