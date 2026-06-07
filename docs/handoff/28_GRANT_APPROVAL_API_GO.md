# 28 GRANT APPROVAL API GO Handoff

## Changed Files

- `internal/db/store.go`, `internal/controlplane/server.go`
- `schemas/openapi/mcp-hub.openapi.yaml`, `schemas/openapi/control-plane.openapi.json`

## Contract/Schema Changes

- Existing grant/approval routes preserved.
- Added RFC3339 validation for grant and approval expiration fields.
- Approval decisions now carry requested or override expiration into created grants.

## DB Migration

- No new grant table migration beyond existing baseline.

## Test Results

- `go test ./internal/db ./internal/controlplane ./internal/jobs` passed.

## Remaining TODO

- Durable SQL-backed grant repository wiring remains outside this skeleton.

## Conflict Notes

- Lane A policy already consumes active grants from the same Store snapshot.
