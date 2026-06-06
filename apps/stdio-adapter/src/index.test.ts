import { once } from "node:events";
import type { Server } from "node:http";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createStdioAdapterServer, type StdioAdapterConfig } from "./index";

describe.sequential("stdio adapter", () => {
  it("serves health after startup ping and collects stderr status", async () => {
    const adapter = createTestAdapter("normal-stdio-server.mjs");
    await listen(adapter.server);

    const health = await waitForHealth(adapter.server, 200);

    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ status: "healthy", stderr: [{ line: expect.stringContaining("fixture_started") }] });

    await closeAdapter(adapter);
  });

  it("forwards direct POST requests over stdio", async () => {
    const adapter = createTestAdapter("normal-stdio-server.mjs");
    await listen(adapter.server);
    await waitForHealth(adapter.server, 200);

    const response = await postMcp(adapter.server, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "stdio_echo", arguments: { message: "hello" } }
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: { content: [{ type: "text", text: expect.stringContaining("hello") }] } });

    await closeAdapter(adapter);
  });

  it("serves GET metadata", async () => {
    const adapter = createTestAdapter("normal-stdio-server.mjs");
    await listen(adapter.server);
    await waitForHealth(adapter.server, 200);

    const response = await fetch(url(adapter.server, "/mcp"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ adapter: "stdio-adapter", transport: "stdio_adapter", policy: "serialized_fifo" });

    await closeAdapter(adapter);
  });

  it("returns 202 for notifications without id", async () => {
    const adapter = createTestAdapter("normal-stdio-server.mjs");
    await listen(adapter.server);
    await waitForHealth(adapter.server, 200);

    const response = await postMcp(adapter.server, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true });

    await closeAdapter(adapter);
  });

  it("enforces max request body size", async () => {
    const adapter = createTestAdapter("normal-stdio-server.mjs", { maxBodyBytes: 32 });
    await listen(adapter.server);
    await waitForHealth(adapter.server, 200);

    const response = await postMcp(adapter.server, { jsonrpc: "2.0", id: 2, method: "tools/list", params: { padding: "x".repeat(64) } });

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: "request_body_too_large", maxBodyBytes: 32 });

    await closeAdapter(adapter);
  });

  it("marks health unhealthy after child crash", async () => {
    const adapter = createTestAdapter("crash-stdio-server.mjs");
    await listen(adapter.server);
    await waitForHealth(adapter.server, 200);

    const health = await waitForHealthState(adapter.server, "unhealthy");

    expect(await health.json()).toMatchObject({ status: "unhealthy", unhealthyReason: expect.stringContaining("process exited") });

    await closeAdapter(adapter);
  });

  it("returns 504 and terminates on request timeout", async () => {
    const adapter = createTestAdapter("delayed-stdio-server.mjs", { requestTimeoutMs: 20 });
    await listen(adapter.server);
    await waitForHealth(adapter.server, 200);

    const response = await postMcp(adapter.server, { jsonrpc: "2.0", id: 3, method: "tools/list" });
    const health = await waitForHealthState(adapter.server, "unhealthy");

    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ error: { code: -32012, message: "Stdio request timed out" } });
    expect(await health.json()).toMatchObject({ status: "unhealthy", unhealthyReason: "request timeout" });

    await closeAdapter(adapter);
  });

  it("returns a controlled error when the child exits during an active request", async () => {
    const adapter = createTestAdapter("exit-during-request-stdio-server.mjs");
    await listen(adapter.server);
    await waitForHealth(adapter.server, 200);

    const response = await postMcp(adapter.server, { jsonrpc: "2.0", id: 11, method: "tools/list" });
    const health = await waitForHealthState(adapter.server, "unhealthy");

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: -32010, message: expect.stringContaining("process exited") } });
    expect(await health.json()).toMatchObject({ status: "unhealthy", unhealthyReason: expect.stringContaining("process exited") });

    await closeAdapter(adapter);
  });

  it("marks unhealthy on startup timeout", async () => {
    const adapter = createTestAdapter("startup-timeout-stdio-server.mjs", { startupTimeoutMs: 20 });
    await listen(adapter.server);

    const health = await waitForHealthState(adapter.server, "unhealthy");

    expect(await health.json()).toMatchObject({ status: "unhealthy", unhealthyReason: "startup timeout" });

    await closeAdapter(adapter);
  });

  it("serializes requests with FIFO queue and rejects overflow", async () => {
    const adapter = createTestAdapter("delayed-stdio-server.mjs", { maxQueueDepth: 1, requestTimeoutMs: 500 });
    await listen(adapter.server);
    await waitForHealth(adapter.server, 200);

    const first = postMcp(adapter.server, { jsonrpc: "2.0", id: 4, method: "tools/list" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = postMcp(adapter.server, { jsonrpc: "2.0", id: 5, method: "tools/list" });
    const overflow = await postMcp(adapter.server, { jsonrpc: "2.0", id: 6, method: "tools/list" });

    expect(overflow.status).toBe(503);
    expect(await overflow.json()).toMatchObject({ error: { code: -32011 } });
    expect((await first).status).toBe(200);
    expect((await second).status).toBe(200);

    await closeAdapter(adapter);
  });
});

function createTestAdapter(fixtureName: string, overrides: Partial<StdioAdapterConfig> = {}) {
  const fixturePath = fileURLToPath(new URL(`./fixtures/${fixtureName}`, import.meta.url));
  return createStdioAdapterServer({
    port: 0,
    command: process.execPath,
    args: [fixturePath],
    startupTimeoutMs: 1000,
    requestTimeoutMs: 200,
    maxBodyBytes: 1024 * 1024,
    maxQueueDepth: 4,
    ...overrides
  });
}

async function postMcp(server: Server, body: Record<string, unknown>) {
  return fetch(url(server, "/mcp"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function waitForHealth(server: Server, status: number) {
  const deadline = Date.now() + 2000;
  let lastResponse: Response | undefined;
  while (Date.now() < deadline) {
    const response = await fetch(url(server, "/healthz"));
    if (response.status === status) {
      return response;
    }
    lastResponse = response;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return lastResponse ?? fetch(url(server, "/healthz"));
}

async function waitForHealthState(server: Server, state: string) {
  const deadline = Date.now() + 1000;
  let lastBody: Record<string, unknown> | undefined;
  while (Date.now() < deadline) {
    const response = await fetch(url(server, "/healthz"));
    const body = (await response.json()) as Record<string, unknown>;
    if (body.status === state) {
      return new Response(JSON.stringify(body), { status: response.status, headers: { "content-type": "application/json" } });
    }
    lastBody = body;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return new Response(JSON.stringify(lastBody ?? {}), { status: 503, headers: { "content-type": "application/json" } });
}

async function listen(server: Server) {
  server.listen(0);
  await once(server, "listening");
}

async function closeAdapter(adapter: ReturnType<typeof createStdioAdapterServer>) {
  adapter.runtime.stop();
  adapter.server.close();
  await once(adapter.server, "close");
}

function url(server: Server, path: string) {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server is not listening on a TCP port.");
  }
  return `http://127.0.0.1:${address.port}${path}`;
}
