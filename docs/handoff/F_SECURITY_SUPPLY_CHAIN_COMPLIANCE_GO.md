# Lane F - Security/Supply Chain/Compliance Handoff

## Changed Files

- CI and supply chain: `.github/workflows/ci.yaml`, `Makefile`, `package.json`, `pnpm-lock.yaml`, `go.mod`, `go.work`, `apps/*/Dockerfile`, `servers/k8s/Dockerfile`, `scripts/security/*`, `scripts/gen/schemas.sh`.
- Security/runtime: `internal/policy`, `internal/redaction`, `internal/security`, `internal/gateway`, `internal/db`, `internal/audit`, `internal/jobs`, `internal/controlplane`, `internal/cli`, `tests/security`.
- Contracts/docs: `schemas/openapi/mcp-hub.openapi.yaml`, `schemas/jsonschema/policy-as-code.schema.json`, `docs/*`, `docs/runbooks/EMERGENCY_RESPONSE.md`.

## Contract/Schema Changes

- Added policy-as-code JSON Schema at `schemas/jsonschema/policy-as-code.schema.json`.
- Expanded OpenAPI audit export parameters and platform-admin response documentation.
- Runtime OpenAPI path list already included export/policy routes; no DB migration.

## Tests And Verification

- `GOTOOLCHAIN=go1.26.4 go test ./...`
- `GOTOOLCHAIN=go1.26.4 go build ./apps/api/cmd/api ./apps/gateway/cmd/gateway ./apps/worker/cmd/worker ./apps/cli/cmd/mcphubctl ./servers/k8s/cmd/k8s`
- `GOTOOLCHAIN=go1.26.4 go run golang.org/x/vuln/cmd/govulncheck@latest ./...`
- `pnpm --filter @mcp-hub/web test`
- `pnpm --filter @mcp-hub/web build`
- `pnpm audit --audit-level moderate`
- `scripts/security/scan-supply-chain.sh`
- `SECURITY_IMAGES='' scripts/security/sbom-sign-images.sh`
- `scripts/gen/schemas.sh --check && scripts/gen/openapi.sh --check && pnpm security:mcp-manifests`

## Remaining TODO

- Install `govulncheck`, Syft, and cosign in local developer environments for non-skip local scans; CI installs govulncheck and the scripts preserve skip behavior for optional tools.
- Real registry push/signing still requires registry credentials or keyless cosign identity.
- Dockerfile base image digest pinning still needs release-approved base image digests; the scanner reports these as review items in non-strict mode.

## Cross-Lane Notes

- Go toolchain baseline moved to `1.26` and CI/Docker build images to `1.26.4` to clear standard-library govulncheck findings.
- Web dependency lockfile changed for Vitest/PostCSS vulnerability remediation.
- Web runtime image now declares a non-root user.
