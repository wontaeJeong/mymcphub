import { once } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { McpJsonRpcRequest } from "@mcp-hub/mcp-protocol";
import { describe, expect, it } from "vitest";

import { createGatewayServer } from "./index";
import { createDefaultRegistry } from "./registry";
import type { GatewayServer } from "./types";
import type { UpstreamTransport } from "./upstream";

describe("gateway runtime", () => {
  it("rejects requests without a bearer token", async () => {
    const gateway = createGatewayServer({ upstream: createServerShapedUpstream() });
    await listen(gateway.server);

    const response = await fetch(url(gateway.server, "/mcp/echo"), { method: "GET" });

    expect(response.status).toBe(401);

    await close(gateway.server);
  });

  it("rejects requests with an invalid bearer token", async () => {
    const gateway = createGatewayServer({ upstream: createServerShapedUpstream() });
    await listen(gateway.server);

    const response = await fetch(url(gateway.server, "/mcp/echo"), {
      method: "GET",
      headers: { authorization: "Bearer invalid" }
    });

    expect(response.status).toBe(401);

    await close(gateway.server);
  });

  it.each([
    ["echo", ["echo_message", "get_server_time"]],
    ["internal-docs", ["search_docs", "read_doc"]],
    ["k8s-readonly", ["list_namespaces", "list_pods", "get_pod"]],
    ["stdio-sample", ["stdio_echo", "get_stdio_status"]]
  ])("filters tools/list for %s to granted prompt-06 tools", async (slug, expectedTools) => {
    const gateway = createGatewayServer({ upstream: createServerShapedUpstream() });
    await listen(gateway.server);

    const response = await postMcp(gateway.server, slug, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list"
    });

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(readToolNames(body)).toEqual(expectedTools);

    await close(gateway.server);
  });

  it("proxies tools/call to an HTTP upstream and returns server-shaped output", async () => {
    const upstreamRequests: McpJsonRpcRequest[] = [];
    const upstream = createServer(async (request, response) => {
      const body = await readJsonBody(request);
      upstreamRequests.push(body);
      sendJson(response, 200, {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: { content: [{ type: "text", text: JSON.stringify({ upstream: true, tool: body.params?.name }) }] }
      });
    });
    await listen(upstream);

    const registry = createRegistryWithUpstream("echo", `${url(upstream, "")}/mcp`);
    const gateway = createGatewayServer({ registry });
    await listen(gateway.server);

    const response = await postMcp(gateway.server, "echo", {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "echo_message", arguments: { message: "hello", token: "secret" } }
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: { content: [{ type: "text" }] } });
    expect(upstreamRequests).toHaveLength(1);
    expect(upstreamRequests[0]).toMatchObject({ method: "tools/call", params: { name: "echo_message" } });
    expect(gateway.runtime.auditEvents[0]?.argumentRedactedJson).toMatchObject({ token: "[REDACTED]" });

    await close(gateway.server);
    await close(upstream);
  });

  it("denies connect when no active server-level grant matches", async () => {
    const [baseServer] = createDefaultRegistry();
    if (!baseServer) {
      throw new Error("Default registry is empty.");
    }

    const gateway = createGatewayServer({ registry: [{ ...baseServer, grants: [] }], upstream: createServerShapedUpstream() });
    await listen(gateway.server);

    const response = await postMcp(gateway.server, "echo", { jsonrpc: "2.0", id: 20, method: "tools/list" });

    expect(response.status).toBe(403);
    expect(gateway.runtime.auditEvents[0]).toMatchObject({ policyDecision: "deny", errorCode: "CONNECT_GRANT_REQUIRED" });

    await close(gateway.server);
  });

  it("blocks needs_approval decisions before calling upstream", async () => {
    let calls = 0;
    const upstream: UpstreamTransport = {
      async call() {
        calls += 1;
        return { jsonrpc: "2.0", id: null, result: {} };
      }
    };
    const [baseServer] = createDefaultRegistry();
    if (!baseServer) {
      throw new Error("Default registry is empty.");
    }
    const [baseTool] = baseServer.tools;
    const [baseGrant] = baseServer.grants;
    if (!baseTool || !baseGrant) {
      throw new Error("Default registry missing echo tool or grant.");
    }
    const riskyServer: GatewayServer = {
      ...baseServer,
      tools: [{ ...baseTool, name: "restart_cluster", riskLevel: "high" }, ...baseServer.tools.slice(1)],
      grants: [{ ...baseGrant, allowedTools: ["restart_cluster"] }]
    };
    const gateway = createGatewayServer({ registry: [riskyServer], upstream });
    await listen(gateway.server);

    const response = await postMcp(gateway.server, "echo", {
      jsonrpc: "2.0",
      id: 21,
      method: "tools/call",
      params: { name: "restart_cluster", arguments: {} }
    });

    expect(await response.json()).toMatchObject({ error: { code: -32001 } });
    expect(gateway.runtime.auditEvents[0]).toMatchObject({ policyDecision: "needs_approval", errorCode: "MCP_TOOL_DENIED" });
    expect(calls).toBe(0);

    await close(gateway.server);
  });

  it.each([
    ["internal-docs", "search_docs", { query: "gateway" }],
    ["k8s-readonly", "list_pods", { namespace: "platform" }],
    ["stdio-sample", "stdio_echo", { message: "via adapter" }]
  ])("authorizes %s tools/call and returns upstream content", async (slug, toolName, argumentsJson) => {
    const gateway = createGatewayServer({ upstream: createServerShapedUpstream() });
    await listen(gateway.server);

    const response = await postMcp(gateway.server, slug, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: toolName, arguments: argumentsJson }
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: { content: [{ type: "text" }] } });

    await close(gateway.server);
  });

  it("proxies stdio_adapter registrations to fake HTTP upstreams without spawning subprocesses", async () => {
    const upstreamRequests: McpJsonRpcRequest[] = [];
    const upstream = createServer(async (request, response) => {
      const body = await readJsonBody(request);
      upstreamRequests.push(body);
      sendJson(response, 200, {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: { content: [{ type: "text", text: JSON.stringify({ adapter: true }) }] }
      });
    });
    await listen(upstream);

    const registry = createRegistryWithUpstream("stdio-sample", `${url(upstream, "")}/mcp`);
    const gateway = createGatewayServer({ registry });
    await listen(gateway.server);

    const response = await postMcp(gateway.server, "stdio-sample", {
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: { name: "stdio_echo", arguments: { message: "through gateway" } }
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: { content: [{ type: "text" }] } });
    expect(upstreamRequests).toHaveLength(1);
    expect(upstreamRequests[0]).toMatchObject({ method: "tools/call", params: { name: "stdio_echo" } });

    await close(gateway.server);
    await close(upstream);
  });

  it("denies unknown tools before calling upstream", async () => {
    let calls = 0;
    const upstream: UpstreamTransport = {
      async call() {
        calls += 1;
        return { jsonrpc: "2.0", id: null, result: {} };
      }
    };
    const gateway = createGatewayServer({ upstream });
    await listen(gateway.server);

    const denied = await postMcp(gateway.server, "echo", {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "admin_delete", arguments: { message: "remove" } }
    });

    expect(await denied.json()).toMatchObject({ error: { code: -32001 } });
    expect(gateway.runtime.auditEvents[0]).toMatchObject({ errorCode: "MCP_TOOL_DENIED" });
    expect(calls).toBe(0);

    await close(gateway.server);
  });

  it("denies unsupported MCP methods before calling upstream", async () => {
    let calls = 0;
    const upstream: UpstreamTransport = {
      async call() {
        calls += 1;
        return { jsonrpc: "2.0", id: null, result: {} };
      }
    };
    const gateway = createGatewayServer({ upstream });
    await listen(gateway.server);

    const denied = await postMcp(gateway.server, "echo", {
      jsonrpc: "2.0",
      id: 22,
      method: "sampling/createMessage",
      params: { messages: [] }
    });

    expect(await denied.json()).toMatchObject({ error: { code: -32601, message: "Unsupported MCP method sampling/createMessage" } });
    expect(gateway.runtime.auditEvents[0]).toMatchObject({ errorCode: "MCP_METHOD_UNSUPPORTED", policyDecision: "deny" });
    expect(calls).toBe(0);

    await close(gateway.server);
  });

  it("requires platform admin authorization for Gateway admin methods", async () => {
    let calls = 0;
    const upstream: UpstreamTransport = {
      async call() {
        calls += 1;
        return { jsonrpc: "2.0", id: null, result: {} };
      }
    };
    const [baseServer] = createDefaultRegistry();
    if (!baseServer) {
      throw new Error("Default registry is empty.");
    }
    const readerServer: GatewayServer = {
      ...baseServer,
      grants: [
        ...baseServer.grants,
        {
          subjectType: "team",
          subjectId: "readonly-team",
          projectId: "00000000-0000-4000-8000-000000000020",
          allowedTools: ["echo_message"],
          environment: "dev"
        }
      ]
    };
    const gateway = createGatewayServer({ registry: [readerServer], upstream });
    await listen(gateway.server);

    const denied = await postMcpWithToken(gateway.server, "echo", "dev-readonly-token", {
      jsonrpc: "2.0",
      id: 23,
      method: "admin/reload",
      params: {}
    });

    expect(await denied.json()).toMatchObject({ error: { code: -32001 } });
    expect(gateway.runtime.auditEvents[0]).toMatchObject({ errorCode: "ADMIN_REQUIRES_PLATFORM_ADMIN", policyDecision: "deny" });
    expect(calls).toBe(0);

    await close(gateway.server);
  });

  it("returns JSON-RPC errors for malformed requests before calling upstream", async () => {
    let calls = 0;
    const upstream: UpstreamTransport = {
      async call() {
        calls += 1;
        return { jsonrpc: "2.0", id: null, result: {} };
      }
    };
    const gateway = createGatewayServer({ upstream });
    await listen(gateway.server);

    const parseError = await postRawMcp(gateway.server, "echo", "{");
    const invalidEnvelope = await postRawMcp(gateway.server, "echo", JSON.stringify({ jsonrpc: "1.0", id: 10, method: "tools/list" }));

    expect(parseError.status).toBe(400);
    expect(await parseError.json()).toMatchObject({ error: { code: -32700, message: "Parse error" } });
    expect(invalidEnvelope.status).toBe(400);
    expect(await invalidEnvelope.json()).toMatchObject({ error: { code: -32600, message: "Invalid Request" } });
    expect(calls).toBe(0);

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
    const gateway = createGatewayServer({ registry: [disabledServer], upstream: createServerShapedUpstream() });
    await listen(gateway.server);

    const response = await postMcp(gateway.server, "echo", { jsonrpc: "2.0", id: 5, method: "ping" });

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

    for (const id of [6, 7, 8]) {
      await postMcp(gateway.server, "echo", {
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name: "echo_message", arguments: { message: "hello" } }
      });
    }
    const degraded = await postMcp(gateway.server, "echo", {
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: { name: "echo_message", arguments: { message: "hello" } }
    });

    expect(degraded.status).toBe(503);
    expect(gateway.runtime.metrics.upstreamFailureCount).toBeGreaterThan(0);

    await close(gateway.server);
  });
});

function createServerShapedUpstream(): UpstreamTransport {
  return {
    async call(_server, request) {
      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: { content: [{ type: "text", text: JSON.stringify({ method: request.method, params: request.params ?? {} }) }] }
      };
    }
  };
}

function createRegistryWithUpstream(slug: string, upstreamUrl: string) {
  return createDefaultRegistry().map((server) => (server.slug === slug ? { ...server, upstreamUrl } : server));
}

async function postMcp(server: ReturnType<typeof createGatewayServer>["server"], slug: string, body: Record<string, unknown>) {
  return postMcpWithToken(server, slug, "dev-admin-token", body);
}

async function postMcpWithToken(
  server: ReturnType<typeof createGatewayServer>["server"],
  slug: string,
  token: string,
  body: Record<string, unknown>
) {
  return fetch(url(server, `/mcp/${slug}`), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

async function postRawMcp(server: ReturnType<typeof createGatewayServer>["server"], slug: string, body: string) {
  return fetch(url(server, `/mcp/${slug}`), {
    method: "POST",
    headers: {
      authorization: "Bearer dev-admin-token",
      "content-type": "application/json"
    },
    body
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

async function readJsonBody(request: IncomingMessage): Promise<McpJsonRpcRequest> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as McpJsonRpcRequest;
}

function sendJson(response: ServerResponse, statusCode: number, payload: Record<string, unknown>) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(payload));
}

function readToolNames(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [];
  }

  const result = (body as Record<string, unknown>).result;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return [];
  }

  const tools = (result as Record<string, unknown>).tools;
  if (!Array.isArray(tools)) {
    return [];
  }

  return tools.map((tool) => (tool && typeof tool === "object" && !Array.isArray(tool) ? (tool as Record<string, unknown>).name : undefined));
}
