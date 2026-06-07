# 62. SECURITY_SCAN_CI_GO_CORE Handoff

## Changed Files

- `.github/workflows/ci.yaml`
- `Makefile`
- `package.json`
- `pnpm-lock.yaml`
- `scripts/security/scan-supply-chain.sh`
- `scripts/security/check-all.sh`
- `scripts/security/README.md`
- `docs/CI.md`
- `docs/SECURITY.md`

## Contract/Schema Changes

- None.

## DB Migration

- None.

## Tests And Verification

- `GOTOOLCHAIN=go1.26.4 go run golang.org/x/vuln/cmd/govulncheck@latest ./...`
- `scripts/security/scan-supply-chain.sh`
- `pnpm audit --audit-level moderate`

## Remaining TODO

- Local `govulncheck` may skip unless installed in PATH; CI installs it before running the script.

## Conflict Notes

- Go CI version changed to `1.26.4`.
