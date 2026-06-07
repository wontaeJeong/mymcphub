# 59 Denied Call Analytics Handoff

## Changed Files

- `internal/db/types.go`
- `internal/db/store.go`
- `internal/controlplane/server.go`
- `apps/web/lib/api.ts`
- `apps/web/app/operations/page.tsx`
- `schemas/openapi/mcp-hub.openapi.yaml`
- `schemas/openapi/control-plane.openapi.json`

## Contract/Schema Changes

- Added `GET /api/analytics/denied-calls` with reason, top tool, top server, and policy-tuning guidance aggregates.
- Denied-call analytics require the platform-admin auth boundary.

## DB Migration

- None.

## Verification

- Go tests, Web tests/typecheck, schema checks, build, and manual denied analytics QA passed.

## Remaining TODO

- None.

## Conflict Notes

- Operations UI now depends on this endpoint; API route changes should remain backward compatible.
