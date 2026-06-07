# 60 Health Check Scheduler Handoff

## Changed Files

- `internal/config/config.go`
- `internal/db/types.go`
- `internal/db/store.go`
- `internal/jobs/jobs.go`
- `internal/worker/server.go`
- `apps/web/lib/api.ts`
- `apps/web/components/tables.tsx`
- `internal/jobs/jobs_test.go`

## Contract/Schema Changes

- Server health rows can include `traceId`, `attempt`, and `backoffSeconds`.
- Worker interval can be configured with `MCP_WORKER_INTERVAL_SECONDS`.

## DB Migration

- None.

## Verification

- Go tests, Web tests/typecheck, build, and manual Worker `/jobs/run` plus `/metrics` QA passed.

## Remaining TODO

- None.

## Conflict Notes

- Future health probes can replace the current catalog-state health heuristic while preserving status history/backoff fields.
