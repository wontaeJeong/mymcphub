import { once } from "node:events";

import { describe, expect, it } from "vitest";

import { createGatewayServer } from "./index";
import { createDefaultRegistry } from "./registry";
import type { GatewayServer } from "./types";
import type { UpstreamTransport } from "./upstream";

describe("gateway runtime", () => {
  it("rejects requests without a bearer token", async () => {
    const gateway = createGatewayServer();
    await listen(gateway.server);

    const response = await fetch(url(gateway.server, "/mcp/echo"), { method: "GET" });

    expect(response.status).toBe(401);

    await close(gateway.server);
  });

  it("filters tools/list to granted enabled tools", async () => {
    const gateway = createGatewayServer();
    await listen(gateway.server);

    const response = await postMcp(gateway.server, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list"
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      result: {
        tools: [{ name: "echo" }]
      }
    });

    await close(gateway.server);
  });

  it("authorizes allowed tool calls and audits denials", async () => {
    const gateway = createGatewayServer();
    await listen(gateway.server);

    const allowed = await postMcp(gateway.server, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "echo", arguments: { message: "hello", token: "secret" } }
    });
    const denied = await postMcp(gateway.server, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "admin_delete", arguments: { message: "remove" } }
    });

    expect(await allowed.json()).toMatchObject({ result: { content: [{ type: "text" }] } });
    expect(await denied.json()).toMatchObject({ error: { code: -32001 } });
    expect(gateway.runtime.auditEvents[0]).toMatchObject({ errorCode: "MCP_TOOL_DENIED" });
    expect(gateway.runtime.auditEvents[1]?.argumentRedactedJson).toMatchObject({ token: "[REDACTED]" });

    await close(gateway.server);
  });

  it("rejects disabled servers", async () => {
    const [baseServer] = createDefaultRegistry();
    if (!baseServer) {
      throw new Error("Default registry is empty.");
    }

    const disabledServer: GatewayServer = {
      ...baseServer,
      enabled: false
    };
    const gateway = createGatewayServer({ registry: [disabledServer] });
    await listen(gateway.server);

    const response = await postMcp(gateway.server, { jsonrpc: "2.0", id: 4, method: "ping" });

    expect(response.status).toBe(403);

    await close(gateway.server);
  });

  it("records upstream failures and degrades the circuit", async () => {
    const failingUpstream: UpstreamTransport = {
      async call() {
        throw new Error("UPSTREAM_FAILED");
      }
    };
    const gateway = createGatewayServer({ upstream: failingUpstream });
    await listen(gateway.server);

    for (const id of [5, 6, 7]) {
      await postMcp(gateway.server, { jsonrpc: "2.0", id, method: "ping" });
    }
    const degraded = await postMcp(gateway.server, { jsonrpc: "2.0", id: 8, method: "ping" });

    expect(degraded.status).toBe(503);
    expect(gateway.runtime.metrics.upstreamFailureCount).toBeGreaterThan(0);

    await close(gateway.server);
  });
});

async function postMcp(server: ReturnType<typeof createGatewayServer>["server"], body: Record<string, unknown>) {
  return fetch(url(server, "/mcp/echo"), {
    method: "POST",
    headers: {
      authorization: "Bearer dev-admin-token",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

async function listen(server: ReturnType<typeof createGatewayServer>["server"]) {
  server.listen(0);
  await once(server, "listening");
}

async function close(server: ReturnType<typeof createGatewayServer>["server"]) {
  server.close();
  await once(server, "close");
}

function url(server: ReturnType<typeof createGatewayServer>["server"], path: string) {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server is not listening on a TCP port.");
  }
  return `http://127.0.0.1:${address.port}${path}`;
}
