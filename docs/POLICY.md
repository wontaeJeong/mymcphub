# Auth and Policy Model

MCP Hub policy evaluation lives in Go under `internal/policy` and is enforced by both the Control Plane API and the Gateway.

## Authentication

Local development uses mock auth:

- `dev-admin-token` maps to a platform-admin principal for Gateway requests.
- `dev-readonly-token` maps to a non-admin principal.
- The API builds a mock admin context unless `MCP_AUTH_MODE=oidc` is set.
- With `MCP_AUTH_MODE=oidc`, the API reads trusted ingress headers such as `x-user-id`, `x-team-ids`, `x-groups`, and `x-roles`.

Runtime JWKS fetching is not implemented in this skeleton. Shared deployments should put API/Gateway behind a trusted auth proxy or ingress.

## Rules

- Emergency deny runs before normal authorization.
- Admin actions require a platform-admin principal.
- Disabled or quarantined servers are denied.
- Tool discovery returns only enabled tools allowed by active grants.
- Tool calls recheck server, tool, principal, grant, environment, and emergency state before upstream calls.
- High and critical tools require explicit approved grants.
- Critical tools require step-up state before allow.

## Gateway Enforcement

The Gateway validates bearer auth on every `/mcp/{serverSlug}` request, resolves the slug from the catalog, checks connect policy, filters `tools/list`, and rechecks `tools/call` before upstream calls. Denies are audited.
