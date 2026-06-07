# 33 AUDIT QUERY API GO Handoff

## Changed Files

- `internal/db/control_plane_types.go`, `internal/db/control_plane_store.go`, `internal/db/store.go`
- `internal/controlplane/server.go`, `internal/controlplane/server_test.go`
- `schemas/openapi/mcp-hub.openapi.yaml`, `schemas/openapi/control-plane.openapi.json`
- `docs/API.md`, `docs/DATA_MODEL.md`

## Contract/Schema Changes

- Existing filtered audit search and redacted export response preserved.
- Added `POST /api/audit-events/export` to queue export jobs.
- Added `GET /api/audit-events/export/jobs`.

## DB Migration

- `0003_lane_b_control_plane_api.sql` adds `audit_export_jobs`.

## Test Results

- Store and API audit export job tests passed.
- `go test ./internal/db ./internal/controlplane ./internal/jobs` passed.

## Remaining TODO

- Actual external export delivery remains future Worker/storage integration.

## Conflict Notes

- Lane E observability/audit work can replace queued skeleton jobs with durable export execution.
