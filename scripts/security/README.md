# Security Scripts

Run prompt-11 security checks from the repository root:

```sh
pnpm security:deps
pnpm security:images
pnpm security:secrets
pnpm security:k8s
pnpm security:mcp-manifests
pnpm security:check
```

Missing external tools print `SKIP: <tool> not found` and exit successfully in normal mode. Set `SECURITY_STRICT=1` to make missing tools and review findings fail the shell scanners.

Useful optional inputs:

- `SECURITY_IMAGES=registry.example.com/mcp-hub/api@sha256:...` scans comma-separated images with installed image scanners.
- `COSIGN_KEY` enables key-based cosign verification; `COSIGN_CERTIFICATE_IDENTITY` plus `COSIGN_CERTIFICATE_OIDC_ISSUER` enables keyless cosign verification.
- `SECURITY_PNPM_AUDIT=1` enables `pnpm audit` from `scan-deps.sh`.
- `pnpm security:mcp-manifests -- servers/k8s/mcp-server.manifest.json` checks explicit manifest paths instead of the default `servers/*/mcp-server.manifest.json` set.
