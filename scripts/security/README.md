# Security Scripts

Run security checks from the repository root:

```sh
pnpm security:deps
pnpm security:supply-chain
pnpm security:images
pnpm security:sbom
pnpm security:secrets
pnpm security:k8s
pnpm security:mcp-manifests
pnpm security:check
```

Missing external tools print `SKIP: <tool> not found` and exit successfully in normal mode. Set `SECURITY_STRICT=1` to make missing tools and review findings fail the shell scanners. The lightweight committed-secret pattern review scans tracked files only so ignored local files such as `.env` are not printed.

Useful optional inputs:

- `SECURITY_IMAGES=registry.example.com/mcp-hub/api@sha256:...` scans comma-separated images with installed image scanners.
- `SECURITY_SBOM_DIR=security-reports/sbom` chooses where Syft writes CycloneDX SBOMs.
- `SECURITY_SIGN_IMAGES=1` signs supplied images with cosign when credentials or keyless identity are configured.
- `SECURITY_ATTEST_SBOM=1` attaches generated SBOMs as cosign attestations.
- `COSIGN_KEY` enables key-based cosign verification; `COSIGN_CERTIFICATE_IDENTITY` plus `COSIGN_CERTIFICATE_OIDC_ISSUER` enables keyless cosign verification.
- `SECURITY_PNPM_AUDIT=1` enables `pnpm audit` from `scan-deps.sh`.
- `pnpm security:mcp-manifests -- servers/k8s/mcp-server.manifest.json` checks explicit manifest paths instead of the default `servers/*/mcp-server.manifest.json` set.

`scan-supply-chain.sh` runs `govulncheck`, `pnpm audit` or `npm audit`, `pip-audit` when Python manifests exist, and Trivy filesystem scanning when those tools are installed.
