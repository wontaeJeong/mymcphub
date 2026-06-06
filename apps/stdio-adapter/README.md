# stdio Adapter

Isolated HTTP-to-stdio MCP adapter runtime. The adapter runs one configured stdio MCP child process per adapter instance and exposes it as Streamable HTTP-style JSON-RPC at `GET /mcp`, `POST /mcp`, and `GET /healthz`.

## Local Run

```sh
pnpm --filter @mcp-hub/server-stdio-sample build
STDIO_MCP_COMMAND=node \
STDIO_MCP_ARGS=servers/stdio-sample/dist/index.js \
STDIO_WORKDIR=. \
PORT=5103 \
pnpm --filter @mcp-hub/stdio-adapter dev
```

## Endpoints

- `GET /healthz` returns `200` when the child process has answered the startup ping and `503` after crash, startup timeout, protocol violation, or request timeout.
- `GET /mcp` returns adapter metadata, queue policy, configured command metadata, and current status.
- `POST /mcp` forwards one JSON-RPC message to the child process over newline-delimited stdio.

## Configuration

| Environment variable | Default | Description |
| --- | --- | --- |
| `PORT` | `5103` | HTTP listen port. |
| `STDIO_MCP_COMMAND` | `node` | Executable to spawn with `shell: false`. |
| `STDIO_MCP_ARGS` | empty | Whitespace-delimited args or JSON array of string args. |
| `STDIO_WORKDIR` | current process cwd | Child working directory. |
| `STDIO_STARTUP_TIMEOUT_MS` | `10000` | Time allowed for child to answer adapter startup `ping`. |
| `STDIO_REQUEST_TIMEOUT_MS` | `30000` | Time allowed for each request with an id. |
| `STDIO_MAX_BODY_BYTES` | `1048576` | Maximum HTTP request body size before `413`. |
| `STDIO_MAX_QUEUE_DEPTH` | `16` | FIFO backlog size behind the single in-flight request. |

## Runtime Policy

- The adapter owns exactly one child process for its lifetime.
- Requests with ids are serialized with one in-flight stdio request at a time and a FIFO queue for additional requests.
- Queue overflow returns HTTP `503` with a JSON-RPC error and does not write to child stdin.
- Notifications without an `id` are accepted with HTTP `202` and `{ "accepted": true }` once queued for stdin delivery.
- Request timeout returns HTTP `504`, marks the adapter unhealthy, and terminates the child because late stdout cannot be safely correlated.
- stdout is parsed only as newline-delimited JSON-RPC protocol frames and is never logged raw.
- stderr lines are retained as structured health/status entries.

## Gateway Proxy

Start the adapter on `5103`, then call through the Gateway registry entry:

```sh
curl http://localhost:5000/mcp/stdio-sample \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"stdio_echo","arguments":{"message":"via gateway"}}}'
```

## Docker

Build an adapter image that includes the sample stdio server from the repository root:

```sh
docker build -f apps/stdio-adapter/Dockerfile -t mcp-hub/stdio-adapter .
docker run --rm -p 5103:5103 \
  -e STDIO_MCP_COMMAND=node \
  -e STDIO_MCP_ARGS=servers/stdio-sample/dist/index.js \
  -e STDIO_WORKDIR=/app \
  mcp-hub/stdio-adapter
```
