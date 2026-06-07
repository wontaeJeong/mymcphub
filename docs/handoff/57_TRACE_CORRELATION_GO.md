# 57 Trace Correlation Handoff

## Changed Files

- `internal/telemetry/telemetry.go`
- `internal/auth/auth.go`
- `internal/logger/logger.go`
- `internal/controlplane/server.go`
- `internal/gateway/server.go`
- `internal/worker/server.go`
- `internal/jobs/jobs.go`
- `apps/web/components/tables.tsx`
- `docs/AUDIT_OBSERVABILITY.md`

## Contract/Schema Changes

- API, Gateway, and Worker now accept and emit `x-trace-id`, `x-request-id`, and W3C `traceparent`.
- Worker health rows can include `traceId`.

## DB Migration

- None.

## Verification

- Go tests, Web tests/typecheck, and manual live trace/header QA passed.

## Remaining TODO

- None.

## Conflict Notes

- Web still filters audit correlation through `trace_id`; generated client regeneration should keep this parameter.
