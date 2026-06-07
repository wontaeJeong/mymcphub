# Security

Core rules:

- Gateway `tools/list` and `tools/call` require a valid bearer token.
- Policy deny happens before upstream calls.
- Unauthorized tools are hidden from discovery.
- Mutations require platform-admin context and create audit events.
- Raw secret, token, password, and credential argument fields are redacted before audit/logging.
- DLP scanning blocks private key and kubeconfig payloads before upstream tool execution, redacts token-like values, and hashes redacted arguments for audit correlation.
- Tool metadata with prompt-injection phrases such as "ignore previous instructions" or "reveal secrets" is hidden from discovery and denied at call time until quarantine review.
- SSRF-like upstream URLs are blocked by the Gateway.
- CLI operations go through the Control Plane API and do not directly mutate DB, Kubernetes, or secrets.
- `MCP_AUTH_MODE=mock` enables local `dev-admin-token` and `dev-readonly-token` Gateway tokens.
- `MCP_AUTH_MODE=oidc` rejects those mock Gateway tokens unless `MCP_ALLOW_MOCK_TOKENS=true` is explicitly set, validates Gateway bearer JWTs with required client identity, and accepts Control Plane trusted identity headers only when `MCP_TRUSTED_AUTH_HEADERS=true` behind an ingress/auth proxy.
- Gateway upstream dialing disables environment HTTP(S) proxies so validated DNS/IP and redirect checks cannot be bypassed by proxy resolution.

Run security checks:

```sh
pnpm security:mcp-manifests
pnpm security:supply-chain
pnpm security:sbom
go test ./tests/security
```

Use `SECURITY_IMAGES=image@sha256:...` for image scan, SBOM, signature, and attestation checks. Missing external tools skip locally unless `SECURITY_STRICT=1` is set.
