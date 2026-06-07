# MCP Gateway

The Gateway runs from `apps/gateway/cmd/gateway` and listens on `127.0.0.1:5000` by default.

## Routes

```txt
GET  /healthz
GET  /readyz
GET  /metrics
GET  /mcp/{serverSlug}
POST /mcp/{serverSlug}
```

`/mcp/{serverSlug}` is matched exactly; malformed prefixes, double slashes, trailing slashes, or extra path segments return `GATEWAY_ROUTE_NOT_FOUND`. `POST /mcp/{serverSlug}` accepts JSON-RPC MCP messages. `initialize` creates a Streamable HTTP session and returns `mcp-session-id`. `tools/list` returns only policy-discoverable tools and includes filtered-count policy metadata. `tools/call` rechecks policy, rate limit, step-up state, and upstream circuit state before any upstream call.

## Runtime Controls

- Gateway catalog/grant/policy state is reloaded through a safe registry cache swap on each request and on `SIGHUP`.
- Invalid cache snapshots are rolled back by retaining the previous registry and incrementing reload failure metrics.
- Rate limiting is runtime-store backed for Gateway and Control Plane API routes, window-based, prunes expired buckets, and is keyed by user, team, project, client, validated server/tool, and method/route dimensions.
- Upstream timeouts use per-server `timeoutMs` when set, otherwise `MCP_GATEWAY_UPSTREAM_TIMEOUT_SECONDS`; upstream failures open a per-server circuit and after the configured open period the circuit enters `half_open` and allows one probe.
- `/metrics` exposes request, filtered discovery, rate limit, reload, upstream latency, and active session counters.
- `MCP_ALLOW_DYNAMIC_CLIENTS=false` enforces the local OAuth client registry; unregistered OIDC clients return `CLIENT_NOT_REGISTERED` before policy or upstream handling.

## Security Behavior

- Missing or invalid bearer tokens return `401` with `WWW-Authenticate`; insufficient JWT scope returns `403`.
- In `MCP_AUTH_MODE=oidc`, Gateway validates bearer JWTs with issuer, audience, expiry/not-before, required scope, required `client_id`/`azp`, and either HS256 local-test secret or RS256/JWKS cache.
- Unknown server slugs return `404`.
- Disabled or quarantined servers return deny responses before upstream calls.
- Unauthorized tools are hidden from `tools/list`.
- Unauthorized `tools/call` returns JSON-RPC `-32001` before upstream calls.
- Critical tools require a one-time `x-mcp-step-up-token` challenge before upstream calls.
- Upstream URLs must be `http` or `https`; link-local/private non-localhost targets are blocked.
- DNS resolution and redirects are validated before upstream calls, environment HTTP(S) proxies are disabled for upstream dialing, and raw upstream URLs are not written to audit metadata.
- Argument keys containing secret, token, password, or credential are redacted before audit.
- The local empty-upstream fallback returns a fixed success message for `tools/call` and does not echo raw arguments.

Local mock tokens:

```txt
Bearer dev-admin-token
Bearer dev-readonly-token
```
