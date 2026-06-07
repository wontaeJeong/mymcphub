# Client Setup

This guide shows how to configure MCP clients from the current MCP Hub surfaces. Manual checks use Gateway routes. The Web and API client config generator always emits Gateway URLs so clients do not bypass Gateway auth, policy, rate limiting, or audit.

Local Gateway base URL:

```txt
http://localhost:5000
```

Local mock bearer token for approved seeded tools:

```txt
dev-admin-token
```

Do not use local mock tokens in shared or production environments. Shared Gateway deployments should use OIDC bearer JWTs from the approved client flow; Control Plane trusted identity headers are accepted only behind an auth proxy with `MCP_TRUSTED_AUTH_HEADERS=true`.

## Generate From The Hub

Open the Web generator:

```txt
http://localhost:3000/client-config
```

Or call the API directly:

```sh
curl -X POST http://localhost:4000/api/client-config/generate \
  -H 'content-type: application/json' \
  -d '{"client":"opencode","serverId":"00000000-0000-4000-8000-000000000102"}'
```

Supported client values are `generic`, `opencode`, `claude-code`, `codex`, and `vscode`. The current API returns placeholders for Claude Code style, Codex style, and VS Code style configs when exact remote MCP formats are uncertain. For the seeded k8s server, generated snippets use `http://localhost:5000/mcp/k8s-readonly` and include a bearer token header placeholder sourced from `MCPHUB_TOKEN`.

## Generic Remote MCP Client

The generic generator currently returns this shape for the seeded k8s server:

```json
{
  "transport": "streamable_http",
  "url": "http://localhost:5000/mcp/k8s-readonly",
  "auth": {
    "type": "bearer",
    "header": "authorization",
    "tokenEnv": "MCPHUB_TOKEN"
  }
}
```

If your client stores headers separately, configure the generated URL and put the required bearer token in the client authentication field. For local Gateway validation, use `http://localhost:5000/mcp/k8s-readonly` with `Bearer dev-admin-token`.

## opencode

The API generator returns this non-placeholder shape for opencode:

```json
{
  "mcp": {
    "k8s-readonly": {
      "type": "remote",
      "url": "http://localhost:5000/mcp/k8s-readonly",
      "headers": {
        "authorization": "Bearer ${MCPHUB_TOKEN}"
      }
    }
  }
}
```

Add the bearer token according to the auth field supported by your opencode version, or use the `/client-config` page to copy the latest generated snippet. For local manual testing, this Gateway request should work before connecting a client:

```sh
curl http://localhost:5000/mcp/k8s-readonly -H 'authorization: Bearer dev-admin-token'
```

## Claude Code Style Config

The current API marks this as a placeholder because remote MCP client formats can differ by version. Start from the generated shape and check your installed client documentation:

```json
{
  "mcpServers": {
    "k8s-readonly": {
      "url": "http://localhost:5000/mcp/k8s-readonly",
      "headers": {
        "authorization": "Bearer ${MCPHUB_TOKEN}"
      },
      "note": "Placeholder format until Claude Code remote MCP config is finalized."
    }
  }
}
```

Prefer the Hub UI generator at `/client-config` or the API generator with `client: "claude-code"` when preparing operator handoff instructions.

## Codex Style Config Placeholder

The current API returns a placeholder for Codex style config:

```json
{
  "mcpServers": {
    "k8s-readonly": {
      "url": "http://localhost:5000/mcp/k8s-readonly",
      "headers": {
        "authorization": "Bearer ${MCPHUB_TOKEN}"
      },
      "note": "Codex MCP remote config placeholder."
    }
  }
}
```

Confirm the exact Codex MCP config format for the installed version before rollout. Use `/client-config` and `POST /api/client-config/generate` as the source for the current Hub-provided snippet.

## VS Code Style Config Placeholder

The current API returns a placeholder for VS Code style config:

```json
{
  "servers": {
    "k8s-readonly": {
      "url": "http://localhost:5000/mcp/k8s-readonly",
      "headers": {
        "authorization": "Bearer ${MCPHUB_TOKEN}"
      },
      "note": "VS Code MCP config placeholder."
    }
  }
}
```

Confirm the exact VS Code extension or workspace config format before rollout. Use `/client-config` and `POST /api/client-config/generate` for the current Hub-provided snippet.

## Troubleshooting

1. Confirm the API and Gateway are running:

```sh
curl http://localhost:4000/healthz
curl http://localhost:4000/readyz
curl http://localhost:5000/metrics
```

2. Confirm the target server is reachable through the Gateway:

```sh
curl http://localhost:5000/mcp/k8s-readonly -H 'authorization: Bearer dev-admin-token'
```

3. Confirm tool discovery works:

```sh
curl http://localhost:5000/mcp/k8s-readonly \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Or use the CLI gateway probe:

```sh
MCPHUB_TOKEN=dev-admin-token \
  go run ./apps/cli/cmd/mcphubctl client test \
  --gateway-url http://localhost:5000 \
  --server k8s-readonly
```

4. If the client can connect but cannot see tools, check grants in `/access`, server detail at `/servers/:serverId`, and denies in `/audit`.
