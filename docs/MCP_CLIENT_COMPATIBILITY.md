# MCP Client Compatibility Matrix

The Go Gateway currently supports authenticated Streamable HTTP at `/mcp/{serverSlug}`. Local compatibility checks use the seeded `k8s-readonly` server and mock bearer token `dev-admin-token`.

| Client | Generated profile | Transport | Auth | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Generic remote MCP | `generic` | Streamable HTTP URL | Client-managed bearer token | Supported | Use the generated URL and configure auth in the client. |
| opencode | `opencode` | Remote MCP URL | Client version dependent bearer config | Supported | API returns a non-placeholder `mcp` object. Validate with `curl` before handoff. |
| Claude Code | `claude-code` | Remote MCP URL placeholder | Client version dependent | Placeholder | API marks this profile as placeholder until exact remote config is confirmed. |
| Codex | `codex` | Remote MCP URL placeholder | Client version dependent | Placeholder | API marks this profile as placeholder until exact remote config is confirmed. |
| Cursor / VS Code | `vscode` | Remote MCP URL placeholder | Extension/workspace dependent | Placeholder | API marks this profile as placeholder until the target extension format is confirmed. |

## Compatibility Test Coverage

`go test ./tests/e2e -run TestClientConfigCompatibilityMatrix` asserts the API returns all supported profile shapes and preserves placeholder status for unconfirmed client-specific formats.

`go test ./tests/e2e -run TestMCPClientFlowInitializeListCallAndDeny` drives the Gateway through:

- `initialize`
- `notifications/initialized`
- `tools/list`
- approved `tools/call`
- missing bearer-token deny
- policy deny for a principal without a matching grant

## Manual Client Handoff Check

Before giving an operator a client snippet, run:

```sh
curl -X POST http://localhost:4000/api/client-config/generate \
  -H 'content-type: application/json' \
  -d '{"client":"opencode","serverId":"00000000-0000-4000-8000-000000000102"}'

curl http://localhost:5000/mcp/k8s-readonly \
  -H 'authorization: Bearer dev-admin-token'
```

Then run one tool discovery call:

```sh
curl http://localhost:5000/mcp/k8s-readonly \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
