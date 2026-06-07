# 20. Tool Call Policy Interceptor Go Handoff

## Changed Files

- `internal/gateway/server.go`, `internal/gateway/server_test.go`
- `internal/mcp/jsonrpc.go`
- `docs/GATEWAY.md`, `docs/POLICY.md`

## Contract / Schema Changes

- JSON-RPC errors can now include `error.data` through `mcp.ErrorData`.
- Tool-call policy denies return machine-readable `code`, `effect`, `serverId`, `serverSlug`, `toolName`, `matchedGrantIds`, `requiresApproval`, and `requiresStepUp` fields.
- Deny paths audit redacted argument data and do not persist raw step-up tokens or raw upstream URLs.
- The local empty-upstream fallback returns a fixed success message and does not echo raw tool arguments.

## DB Migration

- None.

## Test Results

- Step-up test verifies policy deny happens before upstream and redacted audit behavior remains covered.
- Audit regression covers redacted Gateway persistence without leaking token/secret values.
- Gateway regression covers local fallback output not containing secret arguments.

## Remaining TODO

- None.

## Conflict Risk

- Lane E audit analytics should read policy deny details from audit metadata and JSON-RPC error data.
