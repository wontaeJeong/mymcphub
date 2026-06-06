import { once } from "node:events";
import type { Server } from "node:http";

import { createGatewayServer } from "@mcp-hub/gateway";
import { startEchoServer } from "@mcp-hub/server-echo";
import { describe, expect, it } from "vitest";

const authorization = { authorization: "Bearer dev-admin-token" } as const;

describe("mcp hub e2e smoke", () => {
  it("proxies allowed echo calls through the gateway and records audit events", async () => {
    const echoServer = startEchoServer(0);
    await once(echoServer, "listening");

    const gateway = createGatewayServer({
      registry: [
        {
          id: "00000000-0000-4000-8000-000000000100",
          slug: "echo",
          environment: "dev",
          transport: "streamable_http",
          upstreamUrl: `${serverUrl(echoServer)}/mcp`,
          enabled: true,
          tools: [
            {
              name: "echo_message",
              description: "Return the provided message unchanged.",
              enabled: true,
              riskLevel: "low",
              inputSchema: {
                type: "object",
                properties: { message: { type: "string" } },
                required: ["message"],
                additionalProperties: false
              }
            },
            {
              name: "get_server_time",
              description: "Return the current server time as an ISO-8601 timestamp.",
              enabled: true,
              riskLevel: "low",
              inputSchema: { type: "object", properties: {}, additionalProperties: false }
            }
          ],
          grants: [
            {
              subjectType: "team",
              subjectId: "platform-team",
              projectId: "00000000-0000-4000-8000-000000000020",
              allowedTools: ["echo_message"]
            }
          ]
        }
      ]
    });
    await listen(gateway.server);

    try {
      const listResponse = await postMcp(gateway.server, { jsonrpc: "2.0", id: 1, method: "tools/list" });
      expect(listResponse.status).toBe(200);
      expect(await listResponse.json()).toMatchObject({ result: { tools: [{ name: "echo_message" }] } });

      const callResponse = await postMcp(gateway.server, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "echo_message", arguments: { message: "hello from e2e" } }
      });
      expect(callResponse.status).toBe(200);
      expect(await callResponse.json()).toMatchObject({ result: { content: [{ type: "text", text: "hello from e2e" }] } });

      const disallowedResponse = await postMcp(gateway.server, {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "get_server_time", arguments: {} }
      });
      expect(disallowedResponse.status).toBe(200);
      expect(await disallowedResponse.json()).toMatchObject({ error: { code: -32001 } });

      const unknownResponse = await postMcp(gateway.server, {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "missing_tool", arguments: {} }
      });
      expect(unknownResponse.status).toBe(200);
      expect(await unknownResponse.json()).toMatchObject({ error: { code: -32001 } });

      expect(gateway.runtime.auditEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ eventType: "tool.discovery.filtered", policyDecision: "allow" }),
          expect.objectContaining({ eventType: "tool.call.succeeded", policyDecision: "allow", toolName: "echo_message" }),
          expect.objectContaining({ eventType: "tool.call.denied", policyDecision: "deny", toolName: "get_server_time" }),
          expect.objectContaining({ eventType: "tool.call.denied", policyDecision: "deny", toolName: "missing_tool" })
        ])
      );
    } finally {
      await close(gateway.server);
      await close(echoServer);
    }
  });
});

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: {
    name: string;
    arguments: Record<string, unknown>;
  };
};

async function listen(server: Server) {
  server.listen(0);
  await once(server, "listening");
}

async function close(server: Server) {
  server.close();
  await once(server, "close");
}

async function postMcp(server: Server, body: JsonRpcRequest) {
  return fetch(`${serverUrl(server)}/mcp/echo`, {
    method: "POST",
    headers: { ...authorization, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function serverUrl(server: Server) {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server is not listening on a TCP port.");
  }

  return `http://127.0.0.1:${address.port}`;
}
