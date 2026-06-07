# 16. Gateway Route Registry Resolver Go Handoff

## Changed Files

- `internal/gateway/server.go`, `internal/gateway/server_test.go`
- `internal/config/config.go`
- `docs/GATEWAY.md`

## Contract / Schema Changes

- `/mcp/{serverSlug}` now resolves through a safe in-memory registry cache refreshed from the store, and malformed prefixes, double slashes, trailing slashes, and extra path segments return `GATEWAY_ROUTE_NOT_FOUND`.
- Structured route/auth errors use `httpx.WriteError` with machine-readable codes.

## DB Migration

- None.

## Test Results

- Covered by `go test ./...`, gateway hot-reload test, security SSRF test, and manual live Gateway curl QA.

## Remaining TODO

- None.

## Conflict Risk

- Other lanes should not bypass the Gateway registry cache when adding catalog fields.
