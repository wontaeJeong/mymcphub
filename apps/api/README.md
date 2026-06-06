# Control Plane API

Run the API locally with:

```sh
pnpm --filter @mcp-hub/api dev
```

The API uses mock auth by default. Set request headers such as `x-user-id`, `x-user-email`, `x-team-ids`, and `x-roles` with `MCP_AUTH_MODE=oidc` to exercise the OIDC-compatible context path locally.

## Curl Examples

```sh
curl http://localhost:4000/healthz
curl http://localhost:4000/readyz
curl http://localhost:4000/api/me
curl http://localhost:4000/api/servers
curl -X POST http://localhost:4000/api/grants \
  -H 'content-type: application/json' \
  -d '{"subjectType":"team","subjectId":"00000000-0000-4000-8000-000000000010","projectId":"00000000-0000-4000-8000-000000000020","serverId":"00000000-0000-4000-8000-000000000100","allowedTools":["echo_message"],"environment":"dev","reason":"local access"}'
curl 'http://localhost:4000/api/audit-events?limit=10'
curl -X POST http://localhost:4000/api/client-config/generate \
  -H 'content-type: application/json' \
  -d '{"client":"opencode","serverId":"00000000-0000-4000-8000-000000000100"}'
```

Seed data includes `stdio-sample` as a `stdio_adapter` transport server with upstream URL `http://localhost:5103/mcp` and platform-team grants for `stdio_echo` and `get_stdio_status`.

Export OpenAPI with:

```sh
pnpm --filter @mcp-hub/api openapi:write
```
