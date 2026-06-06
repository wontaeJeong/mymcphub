import { once } from "node:events";
import type { Server } from "node:http";

import { describe, expect, it } from "vitest";

import { handleMcpRequest, k8sReadonlyTools, startK8sReadonlyServer } from "./index";

describe("k8s-readonly MCP server", () => {
  it("lists only read-only prompt-06 tools", async () => {
    const response = await handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });

    expect(response.result).toMatchObject({
      tools: [{ name: "list_namespaces" }, { name: "list_pods" }, { name: "get_pod" }]
    });
    expect(k8sReadonlyTools.map((tool) => tool.name)).toEqual(["list_namespaces", "list_pods", "get_pod"]);
    expect(k8sReadonlyTools.map((tool) => tool.name).join(" ")).not.toMatch(/delete|exec|apply|admin|write/i);
  });

  it("lists namespaces and pods from mock data", async () => {
    const namespaces = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "list_namespaces", arguments: {} }
    });
    const pods = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "list_pods", arguments: { namespace: "platform" } }
    });

    const namespaceContent = namespaces.result?.content as [{ text: string }];
    const podContent = pods.result?.content as [{ text: string }];
    expect(JSON.parse(namespaceContent[0].text)).toMatchObject({ namespaces: ["default", "platform", "observability"] });
    expect(JSON.parse(podContent[0].text)).toMatchObject({ pods: [{ name: "mcp-gateway-6f8b9" }] });
  });

  it("gets one pod", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "get_pod", arguments: { namespace: "default", podName: "web-7d9c5f" } }
    });

    const content = response.result?.content as [{ text: string }];
    expect(JSON.parse(content[0].text)).toMatchObject({ pod: { namespace: "default", name: "web-7d9c5f" } });
  });

  it("rejects unknown tools and invalid namespace input", async () => {
    const unknown = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "delete_pod", arguments: {} }
    });
    const invalid = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "list_pods", arguments: { namespace: "kube-system" } }
    });

    expect(unknown.error).toMatchObject({ code: -32601 });
    expect(invalid.error).toMatchObject({ code: -32602, message: "Unknown namespace: kube-system" });
  });

  it("returns JSON-RPC errors for malformed requests", async () => {
    const invalidEnvelope = await handleMcpRequest({ jsonrpc: "1.0", id: 7, method: "tools/list" });
    expect(invalidEnvelope.error).toMatchObject({ code: -32600, message: "Invalid Request" });

    const server = startK8sReadonlyServer(0);
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
