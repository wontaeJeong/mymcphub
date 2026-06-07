# 78 FIXTURE_MOCKING_FRAMEWORK_GO Handoff

## Changed Files

- `tests/fixtures/local-seed.json`
- `tests/fixtures/mock-oidc.json`
- `tests/fixtures/mock-mcp-upstream.json`
- `internal/testutil/fixtures.go`
- `apps/web/test/shared-fixtures.test.ts`
- `tests/e2e/mcp_client_flow_test.go`
- `tests/load/gateway_load_test.go`

## Contract/Schema Changes

- None.

## DB Migration 여부

- No migration added.

## Test Results

- `go test ./internal/testutil ./tests/e2e ./tests/load` passed through `go test ./...`.
- `pnpm --filter @mcp-hub/web test` passed and executes the shared fixture JSON assertion file.

## Remaining TODO

- None.

## Conflict Risks

- Fixture data should be updated with any future seed data changes in `internal/db.NewSeedStore`.
