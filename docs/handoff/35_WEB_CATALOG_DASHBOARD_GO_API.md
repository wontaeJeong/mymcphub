# 35. WEB_CATALOG_DASHBOARD_GO_API Handoff

## Changed Files

- `apps/web/components/tables.tsx`
- `apps/web/test/lane-c-web-contract.test.tsx`

## Contract/Schema Changes

- None.
- Catalog table now displays existing Go API `published` and `quarantined` server fields when present.

## DB Migration

- None.

## Test Results

- Covered by `pnpm --filter @mcp-hub/web test`, `pnpm --filter @mcp-hub/web typecheck`, `make lint`, and `make build`.

## Remaining TODO

- None for the current contract-backed catalog dashboard.

## Conflict Notes

- No shared contract files changed.
