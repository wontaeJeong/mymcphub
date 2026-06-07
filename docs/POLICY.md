# Auth and Policy Model

MCP Hub policy evaluation lives in Go under `internal/policy` and is enforced by both the Control Plane API and the Gateway.

## Authentication

Local development uses mock auth:

- `dev-admin-token` maps to a platform-admin principal for Gateway requests.
- `dev-readonly-token` maps to a non-admin principal.
- The API builds a mock admin context unless `MCP_AUTH_MODE=oidc` is set.
- With `MCP_AUTH_MODE=oidc`, the API can read trusted ingress headers such as `x-user-id`, `x-team-ids`, `x-groups`, and `x-roles` when `MCP_TRUSTED_AUTH_HEADERS=true` or when the request carries `x-auth-proxy-token` matching `MCP_TRUSTED_AUTH_HEADER_TOKEN`.
- With `MCP_AUTH_MODE=oidc`, the Gateway validates bearer JWTs as an OAuth/OIDC resource server. It checks issuer, audience, expiry/not-before, required scope, and either HS256 test secret or RS256 JWKS keys with cache.

Set `OIDC_ISSUER_URL`, `OIDC_AUDIENCE`, `OIDC_REQUIRED_SCOPE`, and either `OIDC_HS256_SECRET` for local tests or `OIDC_JWKS_URL` for RS256 JWT verification. `MCP_ALLOW_MOCK_TOKENS=true` allows local mock bearer tokens even in OIDC mode. `MCP_ALLOW_DYNAMIC_CLIENTS=false` enforces the seeded/local OAuth client registry and returns `CLIENT_NOT_REGISTERED` for unknown Gateway clients. Shared deployments should put API/Gateway behind a trusted auth proxy or ingress that strips caller-supplied identity headers and injects the trusted proxy token.

## Rules

- Emergency deny runs before normal authorization.
- Admin actions require a platform-admin principal.
- Disabled or quarantined servers are denied.
- Tool discovery returns only enabled tools allowed by active grants.
- Tool calls recheck server, tool, principal, grant, environment, and emergency state before upstream calls.
- Grants are project-scoped; `grant.projectId` must match the authenticated principal project before connect, discovery, or tool-call allow decisions.
- High and critical tools require explicit approved grants.
- Critical tools require one-time step-up token state before allow.

## Gateway Enforcement

The Gateway validates bearer auth on every `/mcp/{serverSlug}` request, resolves the slug from the catalog cache, checks project-scoped connect policy, filters `tools/list`, rate-limits by principal/client/server/tool/method dimensions, and rechecks `tools/call` before upstream calls. Denies are audited. Approval-required and step-up-required denials return machine-readable JSON-RPC error data.
