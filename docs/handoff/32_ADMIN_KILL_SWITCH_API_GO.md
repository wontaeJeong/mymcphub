# 32 ADMIN KILL SWITCH API GO Handoff

## Changed Files

- `internal/db/types.go`, `internal/db/control_plane_types.go`, `internal/db/control_plane_store.go`, `internal/db/store.go`
- `internal/controlplane/server.go`, `internal/controlplane/server_test.go`
- `schemas/openapi/mcp-hub.openapi.yaml`, `schemas/openapi/control-plane.openapi.json`
- `docs/API.md`, `docs/DATA_MODEL.md`

## Contract/Schema Changes

- Added `POST /api/admin/kill-switch`.
- Existing emergency deny and revoke-server-grants routes preserved.
- Kill switch can disable/quarantine a server, disable a tool, enable scoped emergency deny, revoke grants, and emits critical audit metadata.

## DB Migration

- `0003_lane_b_control_plane_api.sql` adds emergency deny persistence artifacts.

## Test Results

- Store and API kill-switch tests passed.
- `go test ./internal/db ./internal/controlplane ./internal/jobs` passed.

## Remaining TODO

- Runtime data-plane propagation is through the existing Store snapshot; distributed cache invalidation remains future production wiring.

## Conflict Notes

- Lane A gateway policy already consumes emergency deny state from the Store snapshot.
