# 67. MCP_SERVER_ATTACK_TEST_SUITE_GO Handoff

## Changed Files

- `tests/security/mcp_attack_security_test.go`
- `tests/security/gateway_security_test.go` unchanged but covered by expanded suite.
- `docs/TESTING.md`

## Contract/Schema Changes

- None.

## DB Migration

- None.

## Tests And Verification

- `GOTOOLCHAIN=go1.26.4 go test ./tests/security`
- Included in `GOTOOLCHAIN=go1.26.4 go test ./...`.

## Remaining TODO

- Add direct first-party MCP server tests if `servers/k8s` exposes a reusable handler later.

## Conflict Notes

- The suite verifies command-shaped inputs are inert JSON, path traversal is rejected, SSRF URLs are blocked, secrets are redacted, sensitive payloads are blocked, and unauthorized tools do not reach upstream.
