# 26 CATALOG CRUD API GO Handoff

## Changed Files

- `internal/db/store.go`, `internal/db/control_plane_store.go`, `internal/db/control_plane_types.go`
- `internal/controlplane/server.go`, `internal/controlplane/server_test.go`
- `schemas/openapi/mcp-hub.openapi.yaml`, `schemas/openapi/control-plane.openapi.json`
- `docs/API.md`, `docs/DATA_MODEL.md`

## Contract/Schema Changes

- Added server list pagination/filter query contract.
- Added `DELETE /api/servers/{serverId}`.

## DB Migration

- `internal/db/migrations/0003_lane_b_control_plane_api.sql` adds catalog state columns and indexes.

## Test Results

- `go test ./internal/db ./internal/controlplane ./internal/jobs` passed.

## Remaining TODO

- Durable PostgreSQL repository wiring remains outside this skeleton.

## Conflict Notes

- Lane C should consume the updated OpenAPI paths and generated TS path list.
