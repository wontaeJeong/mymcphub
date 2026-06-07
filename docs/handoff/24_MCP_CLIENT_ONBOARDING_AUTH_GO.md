# 24. MCP Client Onboarding Auth Go Handoff

## Changed Files

- `internal/controlplane/server.go`, `internal/controlplane/server_test.go`
- `internal/db/types.go`, `internal/db/store.go`
- `internal/cli/cli.go`, `internal/cli/cli_test.go`
- `schemas/jsonschema/client-profile.schema.json`
- `.env.example`, `docs/CLIENT_SETUP.md`, `docs/POLICY.md`

## Contract / Schema Changes

- Client config generation now always emits Gateway URL `/mcp/{serverSlug}` and bearer auth placeholder metadata.
- `mcphubctl client test --gateway-url ... --server ...` now performs a live Gateway `tools/list` probe.
- Gateway enforces the local OAuth client registry by default; seed clients include `mcp-client`, `local-dev-client`, and `oidc-client`.

## DB Migration

- None.

## Test Results

- Control-plane test verifies Gateway URL and bearer header are emitted.
- CLI test verifies live Gateway probe request shape.
- Gateway test and live HTTP QA verify unknown OIDC clients receive `CLIENT_NOT_REGISTERED`.

## Remaining TODO

- None.

## Conflict Risk

- Lane C generated client and Web client-config page should use the updated schema fields.
