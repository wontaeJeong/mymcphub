# 18. Gateway OIDC Resource Server Go Handoff

## Changed Files

- `internal/auth/auth.go`, `internal/auth/auth_test.go`
- `internal/gateway/server.go`
- `internal/db/types.go`, `internal/db/store.go`
- `internal/config/config.go`
- `.env.example`, `docs/POLICY.md`, `docs/GATEWAY.md`, `docs/SECURITY.md`

## Contract / Schema Changes

- Gateway bearer failures now set `WWW-Authenticate` and structured auth error envelopes.
- OIDC mode validates JWT issuer, audience, expiry, not-before, required scope, and HS256 or RS256/JWKS signatures.
- Trusted identity headers are opt-in with `MCP_TRUSTED_AUTH_HEADERS=true`; OIDC mode rejects mock Gateway tokens unless `MCP_ALLOW_MOCK_TOKENS=true`.
- Gateway OIDC clients are checked against the local OAuth client registry and unknown clients return `CLIENT_NOT_REGISTERED` unless `MCP_ALLOW_DYNAMIC_CLIENTS=true`.
- OIDC JWTs must carry `client_id` or `azp`; missing client identity returns `AUTH_JWT_CLIENT_ID_MISSING` instead of defaulting to a seed client.

## DB Migration

- None.

## Test Results

- Auth JWT validation and insufficient-scope tests added.
- Gateway unauthenticated test now checks `WWW-Authenticate`.
- Gateway unregistered OIDC client test covers `CLIENT_NOT_REGISTERED`.
- Auth test covers missing JWT client identity.
- Manual live Gateway QA covered unauthenticated `401`, registered OIDC `tools/list`, and unregistered OIDC client deny.

## Remaining TODO

- None.

## Conflict Risk

- Deployment lanes must provide `OIDC_JWKS_URL` for RS256 production tokens or `OIDC_HS256_SECRET` only for local tests.
