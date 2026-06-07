# 64. POLICY_AS_CODE_CHECKS_GO Handoff

## Changed Files

- `internal/policy/policy.go`
- `internal/policy/policy_test.go`
- `internal/controlplane/server.go`
- `schemas/jsonschema/policy-as-code.schema.json`
- `scripts/gen/schemas.sh`
- `docs/POLICY.md`

## Contract/Schema Changes

- Added policy-as-code schema.
- `/api/policy/validate`, `/api/policy/simulate`, and `/api/policy/test-call` now call real validation/simulation instead of unconditional stubs.

## DB Migration

- None.

## Tests And Verification

- `GOTOOLCHAIN=go1.26.4 go test ./internal/policy ./internal/controlplane`
- Included in `GOTOOLCHAIN=go1.26.4 go test ./...`.

## Remaining TODO

- Future lanes can add persisted policy documents if needed; this lane validates request payloads and simulation contexts only.

## Conflict Notes

- Schema generation checks now require `policy-as-code.schema.json`.
