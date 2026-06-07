# MCP Gateway

Go MCP data-plane service.

```sh
go run ./apps/gateway/cmd/gateway
curl http://localhost:5000/mcp/k8s-readonly \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Requests without bearer tokens are denied. Policy deny happens before upstream calls.

The Gateway validates OIDC bearer JWTs when `MCP_AUTH_MODE=oidc`, enforces registered MCP clients unless `MCP_ALLOW_DYNAMIC_CLIENTS=true`, creates Streamable HTTP sessions on `initialize`, filters `tools/list`, enforces windowed quota keys across user/client/server/tool dimensions, requires one-time step-up tokens for critical tools, and hot-reloads catalog/grant/policy state through safe registry cache swaps.

See also:

- [Local Development](../../docs/LOCAL_DEV.md)
- [MVP Demo](../../docs/MVP_DEMO.md)
- [Gateway](../../docs/GATEWAY.md)
