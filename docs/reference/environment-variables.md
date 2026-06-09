# Environment Variables

이 문서는 MCP Hub 로컬 실행과 Web/API/Gateway/Worker 설정을 확인하는 개발자와 운영자를 위한 `.env.example` 기준 환경 변수 참고표다.

!!! warning "Secret handling"
    `OIDC_CLIENT_SECRET`, `MCP_WEB_SESSION_SECRET`, provider client secret, signing key 같은 값은 운영 환경에서 secret manager로 관리한다. 문서, logs, UI, Helm values에 raw secret을 남기지 않는다.

| Variable | Default/example | Scope | Description | Local only |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | `development` | Web/Node tooling | Node/Next.js runtime mode. | No |
| `APP_ENV` | `development` | All services | MCP Hub application environment label. | No |
| `DATABASE_URL` | `postgres://mcp:mcp@localhost:5432/mcp_hub` | Local infra/API direction | Local Postgres connection string placeholder. Current Go core still uses seed/local runtime store behavior for active skeleton state. | Yes |
| `REDIS_URL` | `redis://localhost:6379` | Local infra/future runtime | Local Redis connection string placeholder. | Yes |
| `OIDC_ISSUER_URL` | `http://localhost:8080/realms/mcp-hub` | Gateway/API auth | OIDC issuer for resource-server bearer validation. | No |
| `OIDC_AUDIENCE` | `mcp-hub` | Gateway/API auth | Required token audience. | No |
| `OIDC_REQUIRED_SCOPE` | `mcp:gateway` | Gateway auth | Required scope for Gateway MCP bearer tokens. | No |
| `OIDC_JWKS_URL` | `http://localhost:8080/realms/mcp-hub/protocol/openid-connect/certs` | Gateway/API auth | JWKS endpoint for RS256 token verification. | No |
| `OIDC_HS256_SECRET` | empty | Tests/local auth | Local tests only; shared deployments should use RS256/JWKS. | Yes |
| `OIDC_CLIENT_ID` | `mcp-hub-web` | OIDC/Web | Web/OIDC client id example. | No |
| `OIDC_CLIENT_SECRET` | `dev-secret` | OIDC/Web | Local OIDC client secret example. Use secret manager outside local. | No |
| `MCP_AUTH_MODE` | `mock` | API/Gateway | Auth mode. In `oidc`, mock Gateway tokens are rejected unless explicitly allowed. | No |
| `MCP_ALLOW_MOCK_TOKENS` | `false` | API/Gateway | Allows local mock tokens when explicitly enabled. | Yes |
| `MCP_TRUSTED_AUTH_HEADERS` | `false` | API/Web integration | Allows trusted identity headers from Web/server-side proxy when configured. | No |
| `MCP_ALLOW_DYNAMIC_CLIENTS` | `false` | Gateway/client auth | Allows dynamic clients when enabled by deployment policy. | No |
| `MCP_STORE_PATH` | `/tmp/mcp-hub/store.json` | API/Gateway/Worker | Local runtime JSON store path shared by Go services. Remove or run `pnpm dev:reset-db` to reset local state. | Yes |
| `MCP_PROJECT_ID` | `00000000-0000-4000-8000-000000000020` | API/seed context | Local project id used by seed/default demo context. | Yes |
| `MCP_HUB_PUBLIC_URL` | `http://localhost:3000` | Web | Public Web console base URL. | No |
| `MCP_API_URL` | `http://localhost:4000` | Web/CLI/local | Control Plane API base URL. | No |
| `MCP_GATEWAY_URL` | `http://localhost:5000` | Web/CLI/client config | Gateway base URL for generated client configs. | No |
| `MCP_WEB_AUTH_ENABLED_PROVIDERS` | `dev` | Web auth | Enabled Web browser auth providers. `dev` is non-production local provider. | No |
| `MCP_WEB_SESSION_SECRET` | `dev-only-change-me` | Web auth | Secret for signed HttpOnly Web session cookies. Replace in shared environments. | No |
| `MCP_WEB_SESSION_COOKIE_NAME` | `mcp_hub_session` | Web auth | Web session cookie name. | No |
| `MCP_WEB_SESSION_TTL_SECONDS` | `28800` | Web auth | Web session lifetime in seconds. | No |
| `MCP_WEB_LOCAL_AUTH_ENABLED` | `false` | Web auth | Enables local username/password auth provider when configured. | No |
| `MCP_WEB_LOCAL_USERS` | empty | Web auth | JSON local user list with password hashes, roles, groups, teams. | No |
| `MCP_WEB_DEV_AUTH_ENABLED` | `true` | Web auth | Enables dev provider outside production. | Yes |
| `MCP_WEB_OIDC_OKTA_ENABLED` | `false` | Web OIDC | Example Okta provider enable flag. Add `okta` to `MCP_WEB_AUTH_ENABLED_PROVIDERS` to expose. | No |
| `MCP_WEB_OIDC_OKTA_DISPLAY_NAME` | `Okta` | Web OIDC | Display name for Okta provider. | No |
| `MCP_WEB_OIDC_OKTA_ISSUER_URL` | `https://example.okta.com/oauth2/default` | Web OIDC | Okta issuer URL example. | No |
| `MCP_WEB_OIDC_OKTA_CLIENT_ID` | `example-client-id` | Web OIDC | Okta client id example. | No |
| `MCP_WEB_OIDC_OKTA_CLIENT_SECRET` | empty | Web OIDC | Okta client secret. Use secret manager outside local. | No |
| `MCP_WEB_OIDC_OKTA_SCOPES` | `openid profile email groups` | Web OIDC | Okta scopes requested during login. | No |
| `MCP_WEB_OIDC_OKTA_ADMIN_GROUPS` | `platform-admins,mcp-hub-admins` | Web OIDC | Groups mapped to platform admin. | No |
| `MCP_WEB_OIDC_OKTA_*` | provider-specific | Web OIDC | Pattern for Okta-specific Web OIDC provider settings. | No |
| `MCP_GATEWAY_RATE_LIMIT` | `1000` | Gateway | Gateway request limit per window. | No |
| `MCP_GATEWAY_RATE_LIMIT_WINDOW_SECONDS` | `60` | Gateway | Rate limit window in seconds. | No |
| `MCP_GATEWAY_SESSION_IDLE_SECONDS` | `300` | Gateway | Gateway MCP session idle timeout. | No |
| `MCP_GATEWAY_UPSTREAM_TIMEOUT_SECONDS` | `2` | Gateway | Upstream request timeout. | No |
| `MCP_GATEWAY_CIRCUIT_THRESHOLD` | `3` | Gateway | Circuit breaker open threshold. | No |
| `MCP_GATEWAY_CIRCUIT_OPEN_SECONDS` | `30` | Gateway | Circuit breaker open duration. | No |
| `LOG_LEVEL` | `debug` | Go services | Logging level. | No |
| `API_PORT` | `4000` | Local scripts/docs | Documented API port value. `pnpm dev` sets service `PORT` per process. | Yes |
| `GATEWAY_PORT` | `5000` | Local scripts/docs | Documented Gateway port value. `pnpm dev` sets service `PORT` per process. | Yes |
| `WORKER_PORT` | `4100` | Local scripts/docs | Documented Worker port value. `pnpm dev` sets service `PORT` per process. | Yes |
| `K8S_MCP_PORT` | `5102` | Local scripts/docs | Local Kubernetes MCP sample server port. | Yes |
| `HTTP_PROXY` | empty | Local build/dev | Optional corporate proxy for development/build stages. Runtime Helm workloads do not set HTTP proxy by default. | No |
| `HTTPS_PROXY` | empty | Local build/dev | Optional HTTPS corporate proxy for development/build stages. | No |
| `NO_PROXY` | `localhost,127.0.0.1,.svc,.cluster.local` | Local build/dev | Hosts excluded from proxy. | No |
| `MCP_CORPORATE_CA_CERT_PATH` | empty | Local build/dev | Optional local path to PEM `.crt` copied into `deploy/certs/` before image builds. | No |

## Local reset variables

`MCP_STORE_PATH` is the main local state escape hatch.

```bash
pnpm dev:reset-db
```

또는 `.env`의 `MCP_STORE_PATH`가 가리키는 파일을 제거한 뒤 `pnpm dev`를 다시 시작한다.
