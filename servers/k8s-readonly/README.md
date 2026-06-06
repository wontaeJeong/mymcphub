# Kubernetes Readonly MCP Server

Medium-risk read-only JSON-RPC HTTP MCP server using local mock Kubernetes data by default. It exposes no write, admin, delete, exec, or apply tools.

## Local Run

```sh
pnpm --filter @mcp-hub/server-k8s-readonly dev
```

The server listens on `http://localhost:5102` by default. Override with `PORT=5102`.

## Health Check

```sh
curl http://localhost:5102/health
```

## Tools List

```sh
curl http://localhost:5102/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Tools Call

```sh
curl http://localhost:5102/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_namespaces","arguments":{}}}'

curl http://localhost:5102/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_pod","arguments":{"namespace":"default","podName":"web-7d9c5f"}}}'
```

## Docker

Build from the repository root:

```sh
docker build -f servers/k8s-readonly/Dockerfile -t mcp-hub/server-k8s-readonly .
docker run --rm -p 5102:5102 mcp-hub/server-k8s-readonly
```

## Gateway Proxy

Start this server, then call through the gateway at `http://localhost:5000/mcp/k8s-readonly`:

```sh
curl http://localhost:5000/mcp/k8s-readonly \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"list_pods","arguments":{"namespace":"platform"}}}'
```
