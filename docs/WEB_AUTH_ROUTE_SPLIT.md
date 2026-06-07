# Web Auth And Route Split Design

## Route Model

The Web UI now has separate route trees:

- User: `/user`, `/user/catalog`, `/user/access`, `/user/client-config`, `/user/servers/[serverId]`
- Admin: `/admin`, `/admin/servers`, `/admin/servers/[serverId]`, `/admin/approvals`, `/admin/audit`, `/admin/operations`, `/admin/emergency`

Legacy flat routes redirect to the closest new surface: `/catalog`, `/access`, and `/client-config` redirect to `/user/*`; `/approvals`, `/audit`, and `/operations` redirect to `/admin/*`; `/servers/[serverId]` redirects to `/user/servers/[serverId]`; `/` redirects by session role.

User pages expose catalog browsing, access requests/current visible grants, server/tool read-only detail, and client config generation. Admin pages expose approval decisions, audit/compliance views, server registration/operations, health/usage analytics, and emergency controls.

## Auth Boundary

Browser auth is owned by the Web app and is separate from Gateway MCP sessions. The Web app issues an HttpOnly session cookie containing a signed server-trusted session payload. Control Plane API calls made from server components/actions forward the session identity using the existing trusted-header contract (`x-user-id`, `x-roles`, `x-groups`, etc.) plus the configured trusted proxy secret/header when present.

The Gateway still validates MCP bearer tokens through the existing `MCP_AUTH_MODE`, `OIDC_ISSUER_URL`, `OIDC_AUDIENCE`, `OIDC_REQUIRED_SCOPE`, and client/grant policy flow. Browser session cookies are not sent to `/mcp`.

## Provider Config Format

Web-specific auth configuration uses `MCP_WEB_*` names so it does not collide with API/Gateway resource-server auth:

```env
MCP_WEB_AUTH_ENABLED_PROVIDERS=local,okta,google
MCP_WEB_SESSION_SECRET=change-me-with-a-secret-manager
MCP_WEB_SESSION_COOKIE_NAME=mcp_hub_session
MCP_WEB_SESSION_TTL_SECONDS=28800

MCP_WEB_LOCAL_AUTH_ENABLED=true
MCP_WEB_LOCAL_USERS='[{"id":"admin","username":"admin@example.com","email":"admin@example.com","displayName":"Admin","passwordHash":"scrypt$...","roles":["platform_admin"],"groups":["platform-admins"],"teams":["platform"]}]'

MCP_WEB_OIDC_OKTA_ENABLED=true
MCP_WEB_OIDC_OKTA_DISPLAY_NAME=Okta
MCP_WEB_OIDC_OKTA_ISSUER_URL=https://example.okta.com/oauth2/default
MCP_WEB_OIDC_OKTA_CLIENT_ID=example-client-id
MCP_WEB_OIDC_OKTA_CLIENT_SECRET=example-client-secret
MCP_WEB_OIDC_OKTA_SCOPES=openid profile email groups
MCP_WEB_OIDC_OKTA_ADMIN_GROUPS=platform-admins,mcp-hub-admins

MCP_WEB_OIDC_GOOGLE_ENABLED=true
MCP_WEB_OIDC_GOOGLE_DISPLAY_NAME=Google
MCP_WEB_OIDC_GOOGLE_ISSUER_URL=https://accounts.google.com
MCP_WEB_OIDC_GOOGLE_CLIENT_ID=example-google-client-id
MCP_WEB_OIDC_GOOGLE_CLIENT_SECRET=example-google-client-secret
MCP_WEB_OIDC_GOOGLE_SCOPES=openid profile email
MCP_WEB_OIDC_GOOGLE_ADMIN_EMAIL_DOMAINS=example.com
```

OIDC providers are discovered from `MCP_WEB_AUTH_ENABLED_PROVIDERS`/`MCP_WEB_OIDC_PROVIDERS` and provider-specific env vars. Adding a new OIDC provider requires adding env vars only, not code changes.

## Security Rules

- `MCP_WEB_DEV_AUTH_ENABLED` is available only outside production and is not enabled in production by default.
- Local auth has no default production user. Set explicit users or an explicit admin password hash.
- OIDC login generates PKCE, state, and nonce per transaction, stores them in a signed HttpOnly transaction cookie, validates state/nonce on callback, and verifies RS256 ID token signatures through provider JWKS.
- Admin authorization is mapped from roles/groups/email domains. Existing defaults treat `admin`, `platform_admin`, and `platform-admins` as platform admin indicators.
- Server actions check the Web session before making Control Plane API mutations; admin actions require platform admin before the API call.
- Secrets, tokens, ID tokens, and session cookies are never returned in public provider lists or rendered UI.
