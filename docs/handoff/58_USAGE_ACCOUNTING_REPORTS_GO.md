# 58 Usage Accounting Reports Handoff

## Changed Files

- `internal/db/types.go`
- `internal/db/store.go`
- `internal/controlplane/server.go`
- `apps/web/lib/api.ts`
- `apps/web/app/operations/page.tsx`
- `schemas/openapi/mcp-hub.openapi.yaml`
- `schemas/openapi/control-plane.openapi.json`

## Contract/Schema Changes

- Added `GET /api/analytics/usage` JSON report and `GET /api/analytics/usage/export` CSV export.
- Supports daily/monthly periods and team/project/user/client/server/tool grouping.
- Usage analytics routes require the platform-admin auth boundary.

## DB Migration

- None.

## Verification

- Go tests, Web tests/typecheck, schema checks, build, and manual API usage/export QA passed.

## Remaining TODO

- None in this store-backed implementation.

## Conflict Notes

- Lane C may regenerate or expand typed client support for the new report routes.
