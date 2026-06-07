# 22. Upstream Circuit Breaker Timeouts Go Handoff

## Changed Files

- `internal/gateway/server.go`, `internal/gateway/server_test.go`
- `internal/db/types.go`
- `internal/config/config.go`
- `schemas/jsonschema/mcp-server.schema.json`, `schemas/catalog/mcp-server-manifest.schema.json`
- `docs/GATEWAY.md`

## Contract / Schema Changes

- `GET /mcp/{serverSlug}` reports `circuitState` as `closed`, `open`, or `half_open`.
- Upstream circuit-open failures return JSON-RPC `UPSTREAM_CIRCUIT_OPEN` data with HTTP 503.
- MCP server manifests accept `timeoutMs`; Gateway uses it as a per-server context timeout before falling back to `MCP_GATEWAY_UPSTREAM_TIMEOUT_SECONDS`.
- Upstream HTTP transport disables environment proxies so DNS/redirect SSRF validation cannot be bypassed by `HTTP_PROXY` or `HTTPS_PROXY`.

## DB Migration

- None.

## Test Results

- Gateway test covers failure, open-circuit short-circuit, half-open probe, and success reset.
- Gateway test covers per-server timeout context and proxy-disabled upstream transport.

## Remaining TODO

- None.

## Conflict Risk

- Lane E should align metric labels/dashboards with these circuit state names.
