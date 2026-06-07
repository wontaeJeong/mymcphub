# 34 OPENAPI CONTRACT GENERATION GO TS Handoff

## Changed Files

- `schemas/openapi/mcp-hub.openapi.yaml`, `schemas/openapi/control-plane.openapi.json`
- `scripts/gen/openapi.sh`, `scripts/gen/openapi_json.go`
- `apps/web/lib/generated/mcp-hub-client.ts`, `apps/web/lib/api.ts`
- `internal/controlplane/server.go`
- `docs/CONTRACTS.md`, `docs/CI.md`

## Contract/Schema Changes

- OpenAPI YAML now includes Lane B API paths.
- Runtime `/openapi.json` is exported from Go and generated into `schemas/openapi/control-plane.openapi.json`.
- Generated TS boundary now exposes `MCP_HUB_OPENAPI_PATHS`, `McpHubOpenApiPath`, and path guard helpers.
- Drift check validates YAML paths against runtime Go paths and generated TS path list.

## DB Migration

- Not applicable directly; related API schema changes are mirrored in `0003_lane_b_control_plane_api.sql` where persistence artifacts changed.

## Test Results

- `scripts/gen/openapi.sh` passed.
- `go test ./internal/db ./internal/controlplane ./internal/jobs` passed.

## Remaining TODO

- Endpoint-specific TS operation codegen remains lightweight/path-list based until an external OpenAPI generator is introduced.

## Conflict Notes

- Lane C should treat `apps/web/lib/generated/mcp-hub-client.ts` as generated boundary and regenerate after OpenAPI path changes.
