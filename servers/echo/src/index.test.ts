import { once } from "node:events";
import type { Server } from "node:http";

import { describe, expect, it } from "vitest";

import { echoTools, handleMcpRequest, startEchoServer } from "./index";

describe("echo MCP server", () => {
  it("lists prompt-06 tools", async () => {
    const response = await handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });

    expect(response.result).toMatchObject({
      tools: [{ name: "echo_message" }, { name: "get_server_time" }]
    });
  });

  it("echoes messages", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "echo_message", arguments: { message: "hello" } }
    });

    expect(response.result).toMatchObject({ content: [{ type: "text", text: "hello" }] });
  });

  it("returns server time", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_server_time", arguments: {} }
    });

    const content = response.result?.content;
    expect(Array.isArray(content)).toBe(true);
    const [{ text }] = content as [{ text: string }];
    expect(Number.isNaN(Date.parse(text))).toBe(false);
  });

  it("rejects unknown tools and invalid input", async () => {
    const unknown = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "missing", arguments: {} }
    });
    const invalid = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "echo_message", arguments: { message: 42 } }
    });

    expect(unknown.error).toMatchObject({ code: -32601 });
    expect(invalid.error).toMatchObject({ code: -32602 });
    expect(echoTools.map((tool) => tool.name)).toEqual(["echo_message", "get_server_time"]);
  });

  it("returns JSON-RPC errors for malformed requests", async () => {
    const invalidEnvelope = await handleMcpRequest({ jsonrpc: "1.0", id: 6, method: "tools/list" });
    expect(invalidEnvelope.error).toMatchObject({ code: -32600, message: "Invalid Request" });

    const server = startEchoServer(0);
    await once(server, "listening");

    try {
      const response = await fetch(url(server, "/mcp"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{"
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: -32700, message: "Parse error" } });
    } finally {
      await close(server);
    }
  });
});

async function close(server: Server) {
  server.close();
  await once(server, "close");
}

function url(server: Server, path: string) {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server is not listening on a TCP port.");
  }

  return `http://127.0.0.1:${address.port}${path}`;
}
