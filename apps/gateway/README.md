# MCP Gateway

The gateway exposes MCP Streamable HTTP-style endpoints:

```txt
GET  /mcp/:serverSlug
POST /mcp/:serverSlug
```

Local development uses mock bearer tokens. `Bearer dev-admin-token` maps to the platform team and can call the seeded first-party tools. Requests without a bearer token are rejected.

## Curl Examples

```sh
curl -i http://localhost:5000/mcp/echo

curl http://localhost:5000/mcp/echo \
  -H 'authorization: Bearer dev-admin-token'

curl http://localhost:5000/mcp/echo \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

curl http://localhost:5000/mcp/echo \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"echo_message","arguments":{"message":"hello"}}}'

curl http://localhost:5000/mcp/internal-docs \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_docs","arguments":{"query":"gateway"}}}'

curl http://localhost:5000/mcp/k8s-readonly \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"list_pods","arguments":{"namespace":"platform"}}}'

curl http://localhost:5000/mcp/stdio-sample \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"stdio_echo","arguments":{"message":"via stdio adapter"}}}'
```

Run the first-party HTTP upstream servers on ports `5100`, `5101`, and `5102`, and run the stdio adapter for `stdio-sample` on port `5103`, before using the default HTTP proxy registry. The gateway only proxies HTTP JSON-RPC upstreams; stdio subprocess management belongs to `apps/stdio-adapter`.
