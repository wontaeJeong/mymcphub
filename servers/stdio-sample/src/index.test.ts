import { PassThrough } from "node:stream";

import { createJsonRpcResult, serializeStdioJsonRpcFrame } from "@mcp-hub/mcp-protocol";
import { describe, expect, it } from "vitest";

import { handleStdioMcpRequest, startStdioSampleServer, stdioSampleTools } from "./index";

describe("stdio sample MCP server", () => {
  it("lists stdio sample tools", () => {
    const response = handleStdioMcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });

    expect(response?.result).toMatchObject({ tools: [{ name: "stdio_echo" }, { name: "get_stdio_status" }] });
    expect(stdioSampleTools.map((tool) => tool.name)).toEqual(["stdio_echo", "get_stdio_status"]);
  });

  it("echoes messages and reports status", () => {
    const echo = handleStdioMcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "stdio_echo", arguments: { message: "hello" } }
    });
    const status = handleStdioMcpRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_stdio_status", arguments: {} }
    });

    expect(readFirstText(echo?.result)).toContain('"message":"hello"');
    expect(readFirstText(status?.result)).toContain('"server":"stdio-sample"');
  });

  it("writes protocol frames only to stdout and diagnostics to stderr", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const diagnostics = new PassThrough();
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    output.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    diagnostics.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    const lines = startStdioSampleServer(input, output, diagnostics);
    input.write(serializeStdioJsonRpcFrame({ jsonrpc: "2.0", id: "a", method: "ping" }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    lines.close();

    expect(Buffer.concat(stdoutChunks).toString("utf8")).toBe(serializeStdioJsonRpcFrame(createJsonRpcResult("a", {})));
    expect(Buffer.concat(stderrChunks).toString("utf8")).toContain("stdio_sample_started");
  });

  it("returns errors for invalid tool calls", () => {
    const invalid = handleStdioMcpRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "stdio_echo", arguments: { message: 42 } }
    });

    expect(invalid?.error).toMatchObject({ code: -32602, message: "message must be a string" });
  });
});

function readFirstText(result: Record<string, unknown> | undefined) {
  const content = result?.content;
  if (!Array.isArray(content)) {
    return "";
  }
  const [first] = content;
  if (!first || typeof first !== "object" || Array.isArray(first)) {
    return "";
  }
  const text = (first as Record<string, unknown>).text;
  return typeof text === "string" ? text : "";
}
