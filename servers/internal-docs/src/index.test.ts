import { once } from "node:events";
import type { Server } from "node:http";

import { describe, expect, it } from "vitest";

import { handleMcpRequest, startInternalDocsServer } from "./index";

describe("internal-docs MCP server", () => {
  it("lists prompt-06 tools", async () => {
    const response = await handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });

    expect(response.result).toMatchObject({
      tools: [{ name: "search_docs" }, { name: "read_doc" }]
    });
  });

  it("searches deterministic synthetic docs", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "search_docs", arguments: { query: "gateway", limit: 1 } }
    });

    expect(response.result).toMatchObject({ content: [{ type: "text" }] });
    const content = response.result?.content as [{ text: string }];
    expect(JSON.parse(content[0].text)).toMatchObject({ results: [{ docId: "gateway-runbook" }] });
  });

  it("reads a full document", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "read_doc", arguments: { docId: "first-party-servers" } }
    });

    const content = response.result?.content as [{ text: string }];
    expect(JSON.parse(content[0].text)).toMatchObject({ id: "first-party-servers", title: "First-party Servers" });
  });

  it("rejects unknown tools and invalid search input", async () => {
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
      params: { name: "search_docs", arguments: { query: "" } }
    });

    expect(unknown.error).toMatchObject({ code: -32601 });
    expect(invalid.error).toMatchObject({ code: -32602, message: "query must be a non-empty string" });
  });

  it("returns JSON-RPC errors for malformed requests", async () => {
    const invalidEnvelope = await handleMcpRequest({ jsonrpc: "1.0", id: 6, method: "tools/list" });
    expect(invalidEnvelope.error).toMatchObject({ code: -32600, message: "Invalid Request" });

    const server = startInternalDocsServer(0);
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
