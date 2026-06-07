# 23. Step-Up Auth High-Risk Tools Go Handoff

## Changed Files

- `internal/gateway/server.go`, `internal/gateway/server_test.go`
- `internal/mcp/jsonrpc.go`
- `docs/POLICY.md`, `docs/GATEWAY.md`

## Contract / Schema Changes

- Critical tool calls without step-up return JSON-RPC error data containing a one-time `stepUpToken` and `stepUpTokenHeader`.
- Clients retry with `x-mcp-step-up-token`; consumed tokens cannot be reused.
- Approval-required decisions create an approval request and return `approvalId` when available.
- Audit metadata records only that a step-up token was issued; the token value itself is not persisted.

## DB Migration

- None.

## Test Results

- Gateway step-up test covers challenge, allowed retry, and one-time consumption.
- Step-up audit assertions cover non-leakage of the one-time token and secret-like arguments.

## Remaining TODO

- None.

## Conflict Risk

- Lane C approval UI should surface `approvalId` and step-up error data without assuming plain-text errors.
