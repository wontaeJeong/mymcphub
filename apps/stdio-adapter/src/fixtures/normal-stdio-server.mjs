/* global process */

import { createInterface } from "node:readline";

process.stderr.write(JSON.stringify({ level: "info", event: "fixture_started" }) + "\n");

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on("line", (line) => {
  const request = JSON.parse(line);
  if (request.method === "notifications/initialized") {
    return;
  }
  if (request.method === "ping") {
    write({ jsonrpc: "2.0", id: request.id ?? null, result: {} });
    return;
  }
  if (request.method === "tools/list") {
    write({
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: { tools: [{ name: "stdio_echo", description: "Echo", inputSchema: { type: "object" } }] }
    });
    return;
  }
  if (request.method === "tools/call") {
    write({
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: { content: [{ type: "text", text: JSON.stringify({ echoed: request.params?.arguments?.message ?? null }) }] }
    });
    return;
  }
  write({ jsonrpc: "2.0", id: request.id ?? null, error: { code: -32601, message: "Method not found" } });
});

function write(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}
