# 30 SECRET BINDING API GO Handoff

## Changed Files

- `internal/db/lane_b_types.go`, `internal/db/lane_b_store.go`, `internal/db/store.go`
- `internal/controlplane/server.go`, `internal/controlplane/server_test.go`
- `schemas/openapi/mcp-hub.openapi.yaml`, `schemas/openapi/control-plane.openapi.json`
- `docs/API.md`, `docs/DATA_MODEL.md`

## Contract/Schema Changes

- Added `GET|POST /api/secret-bindings`.
- Added `DELETE /api/secret-bindings/{secretBindingId}`.
- API rejects plaintext secret payload keys and stores only `provider`, `ref`, scope, and lease metadata.

## DB Migration

- `0003_lane_b_control_plane_api.sql` adds lease metadata columns to `secret_refs`.

## Test Results

- API plaintext secret rejection and valid binding creation test passed.
- `go test ./internal/db ./internal/controlplane ./internal/jobs` passed.

## Remaining TODO

- External secret store lookup/injection remains Lane D/runtime work.

## Conflict Notes

- Lane F should preserve the plaintext rejection contract when adding security checks.
