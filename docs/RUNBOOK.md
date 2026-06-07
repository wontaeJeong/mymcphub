# MCP Hub Runbook

Use these runbooks for local, development, staging, and production-style operations. Commands use current repository surfaces. In this skeleton, API state and Gateway state are in memory, Postgres and Redis are support infrastructure, runtime OIDC JWKS verification is not wired into API or Gateway, and canary routing is a disabled placeholder.

Start with these checks unless the situation says otherwise:

```sh
curl http://localhost:4000/healthz
curl http://localhost:4000/readyz
curl http://localhost:5000/metrics
curl http://localhost:5000/mcp/echo -H 'authorization: Bearer dev-admin-token'
pnpm dev:smoke-test
```

Useful Web pages are `/catalog`, `/servers/:serverId`, `/audit`, `/operations`, `/admin`, and `/client-config`.

## 특정 MCP server 장애 (Specific MCP Server Failure)

### 증상

One MCP server route fails, returns JSON-RPC errors, or disappears from client tool discovery while other servers still work.

### 영향 범위

Calls to the affected `/mcp/:serverSlug` route and tools from that server. Other Gateway routes may keep working.

### 즉시 확인할 것

```sh
curl http://localhost:4000/healthz
curl http://localhost:4000/readyz
curl http://localhost:5000/mcp/echo -H 'authorization: Bearer dev-admin-token'
curl http://localhost:5100/health
curl http://localhost:5101/health
curl http://localhost:5102/health
curl http://localhost:5103/healthz
```

Check `/catalog`, `/servers/:serverId`, `/operations`, and `/audit` for disabled state, health records, and recent denies.

### 완화 조치

If the server is unsafe or noisy, disable it from `/admin` or call `POST /api/servers/:serverId/disable`. If grants should be removed too, call `POST /api/admin/revoke-server-grants/:serverId`.

### 근본 원인 확인

Review the upstream process logs, the server manifest, recent version metadata at `GET /api/servers/:serverId/versions`, and recent audit events. For stdio servers, check adapter health and child-process configuration.

### 복구 확인

Re-enable only after the upstream health endpoint passes and `tools/list` works through the Gateway. Run `pnpm dev:smoke-test` for local recovery.

### 사후 조치

Record the failing server slug, trace ids, owner team, disabled grants, and manifest or version changes. Update `docs/MCP_SERVER_ONBOARDING.md` if the lifecycle missed a check.

## upstream timeout 증가 (Upstream Timeout Increase)

### 증상

Gateway latency rises, MCP calls time out, or upstream errors increase for one or more servers.

### 영향 범위

Clients calling slow tools may see delayed responses or JSON-RPC errors. Tool discovery can also be affected if upstream `tools/list` is slow.

### 즉시 확인할 것

```sh
curl http://localhost:5000/metrics
curl http://localhost:5000/mcp/echo \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Check `mcp_gateway_request_duration_ms`, `mcp_gateway_tool_call_duration_ms`, and `mcp_gateway_upstream_errors_total`. Review `/audit` for trace ids and upstream status.

### 완화 조치

Disable the affected high-latency server or revoke grants for that server if the delay creates user impact. Route clients away from the affected server through `/client-config` updates only after approval.

### 근본 원인 확인

Check upstream process logs, network policy changes, recent deploys, and tool arguments. For local infra, inspect `docker compose logs redis`, `docker compose logs postgres`, and `docker compose logs keycloak` if support services are also slow.

### 복구 확인

Metrics should return to normal latency buckets, the Gateway curl should complete quickly, and `/operations` should show healthy server state if health data exists.

### 사후 조치

Add timeout expectations to the server owner runbook and document any approved config changes.

## tool call deny 급증 (Tool Call Deny Spike)

### 증상

`mcp_gateway_policy_denies_total` rises, clients report denied tools, or `/audit` shows many `deny` decisions.

### 영향 범위

Affected users, teams, clients, projects, servers, or tools may lose access. The spike may be desired if an emergency policy is active.

### 즉시 확인할 것

```sh
curl http://localhost:5000/metrics
curl 'http://localhost:4000/api/audit-events?policy_decision=deny&limit=25'
```

Check `/audit`, `/access`, `/servers/:serverId`, and `/admin` for revoked grants, disabled tools, disabled servers, and emergency deny state.

### 완화 조치

If the deny spike is unintended, disable the emergency deny policy with `POST /api/admin/emergency-deny/disable` or restore the correct grant through `/access`. If the spike is protecting users, leave it active and notify affected owners.

### 근본 원인 확인

Compare recent grant changes, approval decisions, tool risk changes, server enabled state, and emergency deny scopes. Confirm high and critical tools have explicit approved grants.

### 복구 확인

Run a targeted `tools/list` and allowed `tools/call` with `dev-admin-token`, then check `/audit` for `allow` decisions.

### 사후 조치

Record the deny reason code, changed grant ids, affected tools, and whether policy docs need clarification.

## audit log 적재 실패 (Audit Log Ingestion Failure)

### 증상

Gateway activity is missing from `/audit`, `POST /api/audit-events/gateway` fails, or audit search returns stale data.

### 영향 범위

Operators may lose visibility into Gateway-observed policy decisions and tool calls. In this skeleton, audit data is in memory and not durable.

### 즉시 확인할 것

```sh
curl http://localhost:4000/healthz
curl 'http://localhost:4000/api/audit-events?limit=10'
curl http://localhost:5000/metrics
```

Check `/audit` and API logs. Confirm the caller is platform admin because Gateway audit ingest requires platform-admin authorization.

### 완화 조치

Keep the Gateway running to preserve its in-memory audit data during investigation. Avoid API restarts unless recovery requires it, because API audit state is in memory.

### 근본 원인 확인

Review API auth mode, trusted headers, request body shape, trace id, and recent API restarts. Check whether the events were only recorded inside the Gateway process and never posted to the API.

### 복구 확인

Create or replay a test Gateway-style audit ingest, then query by trace id in `/api/audit-events`. Confirm `/audit` shows the event.

### 사후 조치

Document lost in-memory audit windows and add durable persistence or forwarding requirements to the next implementation plan.

## DB migration 실패 (DB Migration Failure)

### 증상

`pnpm db:migrate` fails, local setup stops, or the database schema does not match the expected package model.

### 영향 범위

Local or shared support infrastructure can be blocked. Current API and Gateway runtime state are still in memory and not fully persisted through Postgres.

### 즉시 확인할 것

```sh
pnpm db:migrate
docker compose logs postgres
```

Confirm `DATABASE_URL` points at the intended database. Local default is `postgres://mcp:mcp@localhost:5432/mcp_hub`.

### 완화 조치

For local-only recovery, fix the migration issue or reset the compose-local database with `pnpm dev:reset-db` if data loss is acceptable. Do not run destructive reset commands against shared databases.

### 근본 원인 확인

Review the failing migration output, database connectivity, credentials, and whether another process is using port `5432`.

### 복구 확인

Run `pnpm db:migrate`, `pnpm db:seed`, `curl http://localhost:4000/readyz`, and `pnpm dev:smoke-test`.

### 사후 조치

Record the migration name, database target, error output, and whether local volumes were reset.

## OIDC issuer 장애 (OIDC Issuer Outage)

### 증상

OIDC discovery fails, trusted auth proxy cannot verify users, or local Keycloak on port `8080` is unavailable.

### 영향 범위

Shared deployments may block authenticated access at the proxy or ingress. Local mock mode can still work if `MCP_AUTH_MODE=mock` is used.

### 즉시 확인할 것

```sh
docker compose logs keycloak
curl http://localhost:8080/realms/mcp-hub/.well-known/openid-configuration
curl http://localhost:4000/api/me
```

Check `/admin` only if trusted admin identity is still available through the auth boundary.

### 완화 조치

Do not expose API or Gateway directly to bypass OIDC in shared environments. If access must be reduced during outage, use the trusted admin path to enable emergency deny or block specific clients when available.

### 근본 원인 확인

Review Keycloak logs, issuer URL configuration, ingress/proxy health, token audience, and clock skew. Remember API and Gateway do not perform runtime JWKS verification themselves in this skeleton.

### 복구 확인

OIDC discovery succeeds, `GET /api/me` shows the expected trusted identity context, and Web operator pages load behind the proxy.

### 사후 조치

Document outage duration, auth proxy behavior, and whether fallback access paths met security expectations.

## 특정 user/client 차단 (Block A Specific User/Client)

### 증상

A specific user or client should be blocked because of misuse, compromise, or incident response.

### 영향 범위

The targeted subject or client loses access according to the emergency deny scope. Other users or clients should stay unaffected if the scope is narrow.

### 즉시 확인할 것

Find the subject id or client id in `/audit`, `/access`, or `GET /api/me` from the affected session. Check current grants with `GET /api/grants`.

### 완화 조치

Enable scoped emergency deny from `/admin` or the API:

```sh
curl -X POST http://localhost:4000/api/admin/emergency-deny \
  -H 'content-type: application/json' \
  -d '{"reason":"incident response","subjectIds":["<subject-id>"]}'

curl -X POST http://localhost:4000/api/admin/emergency-deny \
  -H 'content-type: application/json' \
  -d '{"reason":"incident response","clientIds":["<client-id>"]}'
```

### 근본 원인 확인

Review audit events by user, client, project, and tool. Confirm whether grants need revocation in addition to temporary emergency deny.

### 복구 확인

The blocked user or client receives deny decisions in `/audit`, while unaffected users still pass expected `tools/list` checks.

### 사후 조치

Record the emergency scope, reason, incident ticket, and decision to revoke or restore grants.

## 특정 server emergency disable (Emergency Disable A Specific Server)

### 증상

One server must be stopped immediately because its tools are unsafe, broken, or misregistered.

### 영향 범위

All clients depending on that server lose access to its tools. Other servers should remain available.

### 즉시 확인할 것

Check `/catalog`, `/servers/:serverId`, `/operations`, `/audit`, and the upstream health endpoint. Confirm the server id and slug before disabling.

### 완화 조치

Use `/admin` or call:

```sh
curl -X POST http://localhost:4000/api/servers/:serverId/disable
curl -X POST http://localhost:4000/api/admin/revoke-server-grants/:serverId
```

For policy-level blocking by slug, use:

```sh
curl -X POST http://localhost:4000/api/admin/emergency-deny \
  -H 'content-type: application/json' \
  -d '{"reason":"unsafe server","serverSlugs":["<server-slug>"]}'
```

### 근본 원인 확인

Review recent schema changes, manifest changes, tool risk levels, upstream deploys, and audit events.

### 복구 확인

The server no longer appears as enabled in `/catalog`, Gateway calls are denied, and `/audit` shows the admin action.

### 사후 조치

Document owner notification, grants revoked, and the criteria for re-enabling.

## high-risk tool 오등록 발견 (High-Risk Tool Misregistration)

### 증상

A tool is registered with too low a risk level, missing schema controls, or hidden side effects.

### 영향 범위

Users may have access without the explicit approval required for high or critical tools.

### 즉시 확인할 것

Check the manifest, `/servers/:serverId`, `/audit`, and grant records. Run:

```sh
pnpm security:mcp-manifests
```

### 완화 조치

Disable the tool from `/admin` or call `POST /api/servers/:serverId/tools/:toolId/disable`. If the whole server is suspect, disable the server or revoke all server grants.

### 근본 원인 확인

Review the owner risk decision, manifest schema, dangerous keywords, approval records, and any recent `tools/list` output.

### 복구 확인

The tool is disabled or corrected, existing access is denied until proper approval exists, and `/audit` reflects the admin action.

### 사후 조치

Update manifest review notes and require owner approval before re-enabling.

## MCP server schema breaking change (MCP Server Schema Breaking Change)

### 증상

Clients fail after a server version change, tool schemas no longer match expected inputs, or `/api/servers/:serverId/schema-diff` shows breaking metadata.

### 영향 범위

Clients using changed tools may fail or send invalid arguments. High-risk tools may need renewed approval.

### 즉시 확인할 것

```sh
curl http://localhost:4000/api/servers/:serverId/versions
curl http://localhost:4000/api/servers/:serverId/schema-diff
curl http://localhost:5000/mcp/echo \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Remember the Worker has a schema diff helper and placeholder, not a wired runtime scanner.

### 완화 조치

Roll back server version metadata with `POST /api/servers/:serverId/versions/:versionId/rollback` if useful, disable affected tools, or disable the server until the owner fixes the schema.

### 근본 원인 확인

Compare manifest schemas, live `tools/list` output, recent version metadata, and owner release notes.

### 복구 확인

Clients can call the tool with expected arguments, `tools/list` matches the approved manifest, and schema diff metadata is reviewed.

### 사후 조치

Record the breaking change, compatibility decision, affected clients, and manifest update.

## Gateway latency 증가 (Gateway Latency Increase)

### 증상

All or many Gateway routes slow down, clients see timeouts, or `/metrics` shows higher Gateway request duration.

### 영향 범위

Multiple MCP servers and clients may be affected. API and Web may still be healthy.

### 즉시 확인할 것

```sh
curl http://localhost:5000/metrics
curl http://localhost:4000/healthz
curl http://localhost:4000/readyz
pnpm dev:smoke-test
```

Check `/operations` and `/audit` for broad failures.

### 완화 조치

Temporarily disable the worst offending server or high-cost tools. If the Gateway deployment is unhealthy in Kubernetes, use normal rollout or rollback procedures.

### 근본 원인 확인

Review Gateway logs, upstream latency, network changes, recent deployments, active sessions, and support infrastructure health.

### 복구 확인

Gateway metrics return to expected latency buckets, smoke test passes, and representative `tools/list` and `tools/call` requests complete.

### 사후 조치

Record affected routes, trace ids, upstreams, and any capacity or timeout changes.

## Redis 장애 (Redis Outage)

### 증상

Local smoke infra checks fail Redis `PING`, or Redis support service is unavailable.

### 영향 범위

Current API and Gateway runtime state is not queued or cached through Redis, so local support checks are affected more than runtime behavior in this skeleton.

### 즉시 확인할 것

```sh
docker compose logs redis
pnpm dev:smoke-test -- --infra-only
```

### 완화 조치

Restart local infra with `pnpm dev:infra` if Redis is down. Do not claim durable queue recovery because no Redis-backed queue is wired yet.

### 근본 원인 확인

Check port `6379`, compose service status, local volume state, and recent infra changes.

### 복구 확인

Infra-only smoke passes and `pnpm dev:smoke-test` passes after app services are running.

### 사후 조치

Document whether the outage affected only support checks or any future Redis-backed feature under development.

## Postgres 장애 (Postgres Outage)

### 증상

Local migration, seed, or infra smoke checks fail for Postgres.

### 영향 범위

Current API and Gateway runtime state is not fully persisted through Postgres, but local setup, migrations, seed scripts, and repository tests are affected.

### 즉시 확인할 것

```sh
docker compose logs postgres
pnpm db:migrate
pnpm dev:smoke-test -- --infra-only
```

### 완화 조치

Restart local infra with `pnpm dev:infra`. For local-only recovery, use `pnpm dev:reset-db` if losing local DB data is acceptable.

### 근본 원인 확인

Check port `5432`, credentials, compose volume state, and migration errors.

### 복구 확인

`pnpm db:migrate`, `pnpm db:seed`, `curl http://localhost:4000/readyz`, and `pnpm dev:smoke-test` pass.

### 사후 조치

Record any data loss, migration errors, and whether support infra readiness checks need updates.

## rollback 절차 (Rollback Procedure)

### 증상

A release, chart values change, or server version change causes errors, latency, failed smoke tests, or unacceptable policy behavior.

### 영향 범위

Depends on the failed component. Web, API, Gateway, Worker, or server catalog metadata may be affected. Canary is a disabled placeholder and does not provide traffic splitting.

### 즉시 확인할 것

```sh
pnpm helm:template
helm history mcp-hub --namespace mcp-hub
curl http://localhost:4000/healthz
curl http://localhost:4000/readyz
curl http://localhost:5000/metrics
```

Check `/catalog`, `/operations`, `/audit`, and `/admin` for current impact.

### 완화 조치

For Helm deployments, roll back to a known-good revision:

```sh
helm rollback mcp-hub <revision> --namespace mcp-hub
```

For GitOps, revert or resync the previous overlay revision. For server metadata only, use `POST /api/servers/:serverId/versions/:versionId/rollback`.

### 근본 원인 확인

Compare image tags or digests, chart values, API version metadata, server version metadata, schema diff output, and audit events.

### 복구 확인

Run health checks, metrics checks, `pnpm dev:smoke-test` where applicable, and representative Gateway `tools/list` and `tools/call` requests. Confirm Helm or GitOps reports the expected revision.

### 사후 조치

Record the failed revision, rollback revision, validation evidence, and the fix needed before the next promotion.
