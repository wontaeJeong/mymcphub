# 29 TOOL SCHEMA DIFF API WORKER GO Handoff

## Changed Files

- `internal/db/types.go`, `internal/db/lane_b_store.go`, `internal/db/store.go`, `internal/db/store_test.go`
- `internal/controlplane/server.go`, `internal/controlplane/server_test.go`
- `internal/jobs/jobs.go`, `internal/jobs/jobs_test.go`
- `docs/WORKER.md`, `docs/API.md`

## Contract/Schema Changes

- Added schema diff fields for snapshots, approval requirement, approval state, and typed changes.
- Added `GET /api/servers/{serverId}/schema-diff/history`.
- Added `GET|POST /api/servers/{serverId}/schema-snapshots`.

## DB Migration

- `0003_lane_b_control_plane_api.sql` adds schema snapshot and schema diff tables.

## Test Results

- Store schema diff history test passed.
- Worker persisted schema diff test passed.
- `go test ./internal/db ./internal/controlplane ./internal/jobs` passed.

## Remaining TODO

- Live upstream schema scans are still represented by Worker job payloads in this skeleton.

## Conflict Notes

- Lane D worker/runtime adapters can feed real previous/current snapshots into the existing Worker job payload.
