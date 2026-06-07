# 19. Tool Discovery Filter Go Handoff

## Changed Files

- `internal/gateway/server.go`, `internal/gateway/server_test.go`
- `schemas/policy/policy-decision.schema.json`
- `docs/GATEWAY.md`

## Contract / Schema Changes

- `tools/list` result includes `_meta.filteredCount`, `_meta.policyDecision`, and `_meta.matchedGrantIds`.
- Policy decision schema documents discovery and trace fields.
- Active grants are project-scoped, so grants from a different project do not make tools discoverable.

## DB Migration

- None.

## Test Results

- Existing discovery filtering test remains passing.
- Gateway metrics now count filtered discovery results.

## Remaining TODO

- None.

## Conflict Risk

- Lane C should tolerate `_meta` in MCP discovery responses used by test-lab UI fixtures.
