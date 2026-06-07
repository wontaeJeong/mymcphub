# 21. Rate Limiting Quotas Go Handoff

## Changed Files

- `internal/ratelimit/ratelimit.go`, `internal/ratelimit/ratelimit_test.go`
- `internal/db/types.go`, `internal/db/store.go`, `internal/db/store_test.go`
- `internal/controlplane/server.go`, `internal/controlplane/server_test.go`
- `internal/gateway/server.go`, `internal/gateway/server_test.go`
- `internal/config/config.go`
- `docs/GATEWAY.md`

## Contract / Schema Changes

- Gateway `429` responses are JSON-RPC errors with `RATE_LIMITED` data and include `x-ratelimit-*` plus `retry-after` headers.
- Control Plane API `429` responses use the standard structured error envelope with `RATE_LIMITED` and the same rate-limit headers.
- Quota buckets are keyed by Gateway/API plane plus user, team, project, client, validated server/tool, method, and canonical API route dimensions where available.
- Full runtime-store saves merge latest audit and quota state before writing so API/Worker saves do not erase Gateway quota updates.
- Expired quota buckets are pruned during quota increments to avoid permanent store growth.

## DB Migration

- None. Quota buckets are stored in the local runtime store and persisted to `MCP_STORE_PATH` when configured; no SQL migration was added.

## Test Results

- Limiter unit test covers window reset and dimension keys.
- Store test verifies quota buckets persist across store instances.
- Store tests verify stale full saves preserve latest quota/audit state and expired buckets are pruned.
- Control Plane test verifies API quota enforcement is store-backed.
- Control Plane test verifies server-shaped random unknown API paths share a canonical quota route key instead of using attacker-controlled IDs.
- Gateway test covers 429 response and headers.
- Manual live Gateway QA covered a registered OIDC client receiving `429` with `RATE_LIMITED` and `retry-after` after exceeding a one-request window.

## Remaining TODO

- None.

## Conflict Risk

- Lane E dashboards can use `mcp_gateway_rate_limited_total`.
