# MCP Gateway

Go MCP data-plane service.

```sh
go run ./apps/gateway/cmd/gateway
curl http://localhost:5000/mcp/echo \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Requests without bearer tokens are denied. Policy deny happens before upstream calls.
