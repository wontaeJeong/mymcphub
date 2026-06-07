# MCP Gateway

The Gateway runs from `apps/gateway/cmd/gateway` and listens on `:5000` by default.

## Routes

```txt
GET  /healthz
GET  /readyz
GET  /metrics
GET  /mcp/{serverSlug}
POST /mcp/{serverSlug}
```

`POST /mcp/{serverSlug}` accepts JSON-RPC MCP messages. `tools/list` returns only policy-discoverable tools. `tools/call` rechecks policy before an upstream call.

## Security Behavior

- Missing or invalid bearer tokens return `401`.
- Unknown server slugs return `404`.
- Disabled or quarantined servers return deny responses before upstream calls.
- Unauthorized tools are hidden from `tools/list`.
- Unauthorized `tools/call` returns JSON-RPC `-32001` before upstream calls.
- Upstream URLs must be `http` or `https`; link-local/private non-localhost targets are blocked.
- Argument keys containing secret, token, password, or credential are redacted before audit.

Local mock tokens:

```txt
Bearer dev-admin-token
Bearer dev-readonly-token
```
