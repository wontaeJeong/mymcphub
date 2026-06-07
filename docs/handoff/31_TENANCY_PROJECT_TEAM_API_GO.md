# 31 TENANCY PROJECT TEAM API GO Handoff

## Changed Files

- `internal/db/control_plane_types.go`, `internal/db/control_plane_store.go`, `internal/db/store.go`, `internal/db/store_test.go`
- `internal/controlplane/server.go`, `internal/controlplane/server_test.go`
- `schemas/openapi/mcp-hub.openapi.yaml`, `schemas/openapi/control-plane.openapi.json`
- `docs/API.md`, `docs/DATA_MODEL.md`

## Contract/Schema Changes

- Added `/api/tenancy/users`, `/api/tenancy/teams`, `/api/tenancy/projects`.
- Added team/project membership mutation routes.
- Added `/api/tenancy/policy-input` for policy-ready principal/project/team context.

## DB Migration

- Baseline migration already contains users, teams, projects, and memberships.

## Test Results

- Store policy input test passed.
- API policy input surface test passed.
- `go test ./internal/db ./internal/controlplane ./internal/jobs` passed.

## Remaining TODO

- Directory/IdP sync remains future integration.

## Conflict Notes

- Lane A policy should continue using `AuthContext.TeamIDs` and `ProjectID`; this lane now exposes the Store-derived input for that shape.
