# MCP Gateway

The Gateway runs from `apps/gateway` and listens on `http://localhost:5000` in local development. It is the MCP data plane for registered server slugs.

The current skeleton keeps the Gateway registry, grants, emergency state, audit events, and metrics in memory. Restarting the Gateway resets those runtime values. Postgres and Redis are available as support infrastructure, but Gateway runtime state is not persisted to Postgres or queued through Redis yet.

## Routes

```txt
GET  /mcp/:serverSlug
POST /mcp/:serverSlug
GET  /metrics
```

There is no Gateway `/healthz` route in the current skeleton. The Helm chart uses TCP probes for the Gateway.

## Local Tokens

Local development uses mock bearer tokens:

| Token | Local meaning |
| --- | --- |
| `dev-admin-token` | Platform team style admin principal with seeded grants. |
| `dev-readonly-token` | Read-only mock principal. |

Requests without a bearer token are rejected. `@mcp-hub/auth` has OIDC JWT verifier support, but Gateway runtime JWKS verification is not wired. Shared deployments need a trusted ingress or auth proxy boundary before traffic reaches the Gateway.

## First-Party Upstreams

The default local registry points at these upstreams:

| Server slug | Transport in catalog | Upstream |
| --- | --- | --- |
| `echo` | `streamable_http` | `http://localhost:5100/mcp` |
| `internal-docs` | `streamable_http` | `http://localhost:5101/mcp` |
| `k8s-readonly` | `streamable_http` | `http://localhost:5102/mcp` |
| `stdio-sample` | `stdio_adapter` | `http://localhost:5103/mcp` |

The Gateway only proxies HTTP JSON-RPC upstreams. Stdio subprocess management belongs to `apps/stdio-adapter`, which exposes the child process as HTTP at `http://localhost:5103/mcp` when started with `pnpm dev:stdio-adapter`.

## Happy Path Checks

Start local infra and app services first:

```sh
pnpm dev:infra
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Then check Gateway reachability and MCP discovery:

```sh
curl http://localhost:5000/metrics
curl http://localhost:5000/mcp/echo -H 'authorization: Bearer dev-admin-token'
curl http://localhost:5000/mcp/echo \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Call the seeded echo tool:

```sh
curl http://localhost:5000/mcp/echo \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"echo_message","arguments":{"message":"hello"}}}'
```

Run the full local smoke path:

```sh
pnpm dev:smoke-test
```

## Enforcement Flow

For each `GET` or `POST /mcp/:serverSlug`, the Gateway:

1. Parses and validates the bearer token in mock mode.
2. Looks up the server slug in the in-memory registry.
3. Evaluates shared policy for `connect`.
4. For `tools/list`, evaluates discovery policy and returns only allowed tools.
5. For `tools/call`, finds the requested tool, evaluates call policy, then proxies upstream.
6. Records in-memory audit and metrics data, including policy denies and upstream failures.

Denied MCP requests return JSON-RPC errors for JSON-RPC calls. Use `/audit` in the Web app or API audit routes when Gateway events have been ingested through `POST /api/audit-events/gateway`.

## Metrics

The Gateway exposes Prometheus text at:

```sh
curl http://localhost:5000/metrics
```

Current metrics include request counts, request duration buckets, tool call counts, tool call duration buckets, policy deny counts, upstream error counts, and active session gauge values. Labels stay low-cardinality and do not include user ids, trace ids, tool arguments, server ids, or tool names.

## Operator Pages

Use these Web pages with the Gateway during local or shared-environment checks:

| Page | Use |
| --- | --- |
| `/catalog` | Confirm the server is registered and enabled. |
| `/servers/:serverId` | Check server tools, versions, audit, and health. |
| `/audit` | Review policy and tool-call evidence. |
| `/operations` | Review server health state. |
| `/admin` | Disable servers, disable tools, revoke grants, or enable emergency deny. |
| `/client-config` | Generate remote MCP client snippets. |
