# Internal Docs MCP Server

Read-only first-party JSON-RPC HTTP MCP server backed by committed synthetic documentation.

## Local Run

```sh
pnpm --filter @mcp-hub/server-internal-docs dev
```

The server listens on `http://localhost:5101` by default. Override with `PORT=5101`.

## Health Check

```sh
curl http://localhost:5101/health
```

## Tools List

```sh
curl http://localhost:5101/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Tools Call

```sh
curl http://localhost:5101/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_docs","arguments":{"query":"gateway","limit":2}}}'

curl http://localhost:5101/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"read_doc","arguments":{"docId":"gateway-runbook"}}}'
```

## Docker

Build from the repository root:

```sh
docker build -f servers/internal-docs/Dockerfile -t mcp-hub/server-internal-docs .
docker run --rm -p 5101:5101 mcp-hub/server-internal-docs
```

## Gateway Proxy

Start this server, then call through the gateway at `http://localhost:5000/mcp/internal-docs`:

```sh
curl http://localhost:5000/mcp/internal-docs \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"search_docs","arguments":{"query":"first-party"}}}'
```
