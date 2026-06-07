# 71 CONTRACT_TESTS_GO_TS Handoff

## Changed Files

- `tests/contract/control_plane_contract_test.go`
- `schemas/openapi/mcp-hub.openapi.yaml`
- `apps/web/test/shared-fixtures.test.ts`
- `docs/CONTRACTS.md` was not changed.

## Contract/Schema Changes

- Added non-breaking OpenAPI examples for `POST /api/client-config/generate`.
- No JSON Schema changes.

## DB Migration 여부

- No migration added.

## Test Results

- `go test ./tests/contract` passed as part of `go test ./...`.
- `scripts/ci/schemas.sh` passed.
- `pnpm --filter @mcp-hub/web test` passed.

## Remaining TODO

- None.

## Conflict Risks

- OpenAPI example block may conflict with Lane B if the client-config contract shape changes.
