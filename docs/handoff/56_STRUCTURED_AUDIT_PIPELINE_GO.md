# 56 Structured Audit Pipeline Handoff

## Changed Files

- `internal/audit/audit.go`
- `internal/db/store.go`
- `internal/db/types.go`
- `internal/gateway/server.go`
- `internal/controlplane/server.go`
- `internal/db/store_test.go`
- `internal/gateway/server_test.go`

## Contract/Schema Changes

- Audit ingestion derives `ToolCallEvent` rows from final `tool.call.*` audit events.
- Audit arguments are redacted and hashed consistently before storage.

## DB Migration

- None. SQL artifacts were not changed because runtime persistence remains JSON-backed.

## Verification

- Go tests and manual API/Gateway QA passed.

## Remaining TODO

- Durable audit writing/retention remains future work if Lane B moves runtime state to Postgres.

## Conflict Notes

- Future store changes should preserve redaction before audit persistence.
