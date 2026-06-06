import { describe, expect, it } from "vitest";

import {
  createJsonRpcError,
  createJsonRpcResult,
  isJsonRpcRequest,
  isJsonRpcResponse,
  parseStdioJsonRpcFrame,
  serializeStdioJsonRpcFrame
} from "./index";

describe("stdio JSON-RPC frame helpers", () => {
  it("serializes newline-delimited JSON-RPC frames", () => {
    const frame = serializeStdioJsonRpcFrame({ jsonrpc: "2.0", id: 1, method: "ping" });

    expect(frame).toBe('{"jsonrpc":"2.0","id":1,"method":"ping"}\n');
  });

  it("parses requests and responses from one line", () => {
    const request = parseStdioJsonRpcFrame('{"jsonrpc":"2.0","id":"a","method":"tools/list"}\n');
    const response = parseStdioJsonRpcFrame('{"jsonrpc":"2.0","id":"a","result":{"tools":[]}}');

    expect(isJsonRpcRequest(request)).toBe(true);
    expect(isJsonRpcResponse(response)).toBe(true);
    expect(response).toMatchObject({ id: "a", result: { tools: [] } });
  });

  it("creates result and error envelopes", () => {
    expect(createJsonRpcResult(2, { ok: true })).toEqual({ jsonrpc: "2.0", id: 2, result: { ok: true } });
    expect(createJsonRpcError(undefined, -32600, "Invalid Request")).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid Request" }
    });
  });

  it("rejects malformed frames", () => {
    expect(() => parseStdioJsonRpcFrame("")).toThrow("STDIO_FRAME_EMPTY");
    expect(() => parseStdioJsonRpcFrame("{")).toThrow("STDIO_FRAME_PARSE_ERROR");
    expect(() => parseStdioJsonRpcFrame('{"jsonrpc":"1.0","id":1,"method":"ping"}')).toThrow("STDIO_FRAME_INVALID_JSON_RPC");
  });
});
