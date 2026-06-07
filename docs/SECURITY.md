# Security

Core rules:

- Gateway `tools/list` and `tools/call` require a valid bearer token.
- Policy deny happens before upstream calls.
- Unauthorized tools are hidden from discovery.
- Mutations require platform-admin context and create audit events.
- Raw secret, token, password, and credential argument fields are redacted before audit/logging.
- SSRF-like upstream URLs are blocked by the Gateway.
- CLI operations go through the Control Plane API and do not directly mutate DB, Kubernetes, or secrets.
- `MCP_AUTH_MODE=mock` enables local `dev-admin-token` and `dev-readonly-token` Gateway tokens.
- `MCP_AUTH_MODE=oidc` rejects those mock Gateway tokens unless `MCP_ALLOW_MOCK_TOKENS=true` is explicitly set, and Control Plane admin context requires trusted identity headers from an ingress/auth proxy.

Run security checks:

```sh
pnpm security:mcp-manifests
go test ./tests/security
```
