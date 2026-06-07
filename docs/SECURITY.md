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
- `MCP_AUTH_MODE=oidc` rejects those mock Gateway tokens unless `MCP_ALLOW_MOCK_TOKENS=true` is explicitly set, validates Gateway bearer JWTs with required client identity, and accepts Control Plane trusted identity headers only when `MCP_TRUSTED_AUTH_HEADERS=true` behind an ingress/auth proxy.
- Gateway upstream dialing disables environment HTTP(S) proxies so validated DNS/IP and redirect checks cannot be bypassed by proxy resolution.

Run security checks:

```sh
pnpm security:mcp-manifests
go test ./tests/security
```
