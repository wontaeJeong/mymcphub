# 27 SERVER VERSION ROLLOUT API GO Handoff

## Changed Files

- `internal/db/types.go`, `internal/db/store.go`, `internal/db/lane_b_store.go`
- `internal/controlplane/server.go`
- `schemas/openapi/mcp-hub.openapi.yaml`, `schemas/openapi/control-plane.openapi.json`
- `docs/API.md`, `docs/DATA_MODEL.md`

## Contract/Schema Changes

- Extended version metadata with rollout status/message and GitOps repo/path/revision fields.
- Added `GET /api/servers/{serverId}/rollout`.

## DB Migration

- `0003_lane_b_control_plane_api.sql` adds rollout and GitOps columns.

## Test Results

- `go test ./internal/db ./internal/controlplane ./internal/jobs` passed.

## Remaining TODO

- Real GitOps controller status sync remains a future runtime integration.

## Conflict Notes

- Lane D/E runtime jobs may later enrich rollout status from deployment telemetry.
