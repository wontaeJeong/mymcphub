# 70 LOCAL_DEV_SEED_DATA_GO Handoff

## Changed Files

- `tests/fixtures/local-seed.json`
- `tests/fixtures/mock-oidc.json`
- `tests/fixtures/mock-mcp-upstream.json`
- `internal/testutil/fixtures.go`
- `apps/web/test/shared-fixtures.test.ts`
- `docs/LOCAL_DEV.md`
- `docs/DEVELOPER_GUIDE.md`
- `scripts/dev/seed.sh`
- `scripts/dev/reset-db.sh`

## Contract/Schema Changes

- None.

## DB Migration 여부

- No migration added.
- Local seed remains code-backed in `internal/db.NewSeedStore`; fixture JSON mirrors it for Go/Web tests.

## Test Results

- `go test ./...` passed.
- `pnpm --filter @mcp-hub/web test` passed.
- `bash -n scripts/dev/seed.sh scripts/dev/reset-db.sh` passed.

## Remaining TODO

- None.

## Conflict Risks

- `docs/LOCAL_DEV.md` and shared fixture constants may need reconciliation if another lane changes seed IDs or sample server tools.
