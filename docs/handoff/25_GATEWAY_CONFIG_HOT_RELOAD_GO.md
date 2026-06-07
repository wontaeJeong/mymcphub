# 25. Gateway Config Hot Reload Go Handoff

## Changed Files

- `internal/gateway/server.go`, `internal/gateway/server_test.go`
- `internal/config/config.go`
- `internal/db/store.go`, `internal/db/store_test.go`
- `internal/worker/server.go`
- `docs/GATEWAY.md`

## Contract / Schema Changes

- Gateway reload metrics added: `mcp_gateway_reload_success_total`, `mcp_gateway_reload_failure_total`, and `mcp_gateway_last_reload_info`.
- `SIGHUP` triggers registry reload in the Gateway process.
- Store persistence uses a file lock and Gateway audit appends merge with latest on-disk state to avoid clobbering hot-reloaded catalog/grant changes.
- `HOST` defaults to `127.0.0.1`; Gateway auth/config env now includes `MCP_TRUSTED_AUTH_HEADERS`, `MCP_ALLOW_DYNAMIC_CLIENTS`, Gateway rate/session/upstream/circuit knobs, and per-server `timeoutMs` override support.

## DB Migration

- None.

## Test Results

- Gateway hot-reload test verifies persisted catalog/grant changes are observed by an existing Gateway handler.
- Store regression verifies audit append does not clobber a newer persisted catalog entry and redacts token/secret data.
- Manual live Gateway HTTP QA passed after remediation.

## Remaining TODO

- None.

## Conflict Risk

- Lane E may add alert rules for reload failures using the new metrics.
