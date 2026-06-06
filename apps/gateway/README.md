# MCP Gateway

The gateway exposes MCP Streamable HTTP-style endpoints:

```txt
GET  /mcp/:serverSlug
POST /mcp/:serverSlug
```

Local development uses mock bearer tokens. `Bearer dev-admin-token` maps to the platform team and can call the seeded `echo` tool. Requests without a bearer token are rejected.

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
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"echo","arguments":{"message":"hello"}}}'
```

The initial stdio adapter transport is represented by interfaces only; concrete stdio adapter execution is implemented later.
