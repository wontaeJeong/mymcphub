# Echo MCP Server

Low-risk first-party JSON-RPC HTTP MCP server for local gateway testing.

## Local Run

```sh
pnpm --filter @mcp-hub/server-echo dev
```

The server listens on `http://localhost:5100` by default. Override with `PORT=5100`.

## Health Check

```sh
curl http://localhost:5100/health
```

## Tools List

```sh
curl http://localhost:5100/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Tools Call

```sh
curl http://localhost:5100/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"echo_message","arguments":{"message":"hello"}}}'
```

## Docker

Build from the repository root:

```sh
docker build -f servers/echo/Dockerfile -t mcp-hub/server-echo .
docker run --rm -p 5100:5100 mcp-hub/server-echo
```

## Gateway Proxy

Start this server, then call through the gateway at `http://localhost:5000/mcp/echo`:

```sh
curl http://localhost:5000/mcp/echo \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"echo_message","arguments":{"message":"via gateway"}}}'
```
