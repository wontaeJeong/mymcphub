# Audit and Observability

MCP Hub currently provides an in-memory audit and observability skeleton. It is useful for local development, contract checks, and UI wiring, but it does not provide durable database persistence, SIEM forwarding, collector/exporter setup, or production retention.

## Audit Source of Truth

Audit records should be based on metadata observed by the Gateway and Control Plane API, not on natural-language answers returned by agents. For MCP tool calls, Gateway-observed server, tool, policy, risk, trace, latency, upstream, and argument metadata are the source of truth.

Agent text can explain what happened, but it is not audit evidence. Use the audit event fields and redacted metadata when reviewing access, policy decisions, or tool execution.

## Redaction and Hashing

Redaction and hashing are separate steps.

- Redaction replaces sensitive values in stored argument snapshots with `[REDACTED]`.
- Hashing computes a stable SHA-256 hash from the redacted argument snapshot so operators can compare repeated inputs without storing raw sensitive values.

The sensitive key set is case-insensitive and includes:

- `password`
- `passwd`
- `token`
- `secret`
- `apiKey`
- `apikey`
- `authorization`
- `cookie`
- `kubeconfig`
- `privateKey`

Do not add raw secrets, tokens, cookies, kubeconfigs, private keys, session ids, or raw tool arguments to logs, metrics, or labels.

## API Audit Search

The Control Plane API exposes audit search at:

```txt
GET /api/audit-events
```

Supported filters:

- `from`
- `to`
- `user`
- `team`
- `project`
- `server`
- `tool`
- `event_type`
- `policy_decision`
- `risk_level`
- `trace_id`
- `limit`
- `cursor`

`from` and `to` must be date-time strings. `policy_decision` accepts `allow`, `deny`, or `needs_approval`. `risk_level` accepts `low`, `medium`, `high`, or `critical`. `limit` is bounded by the API and `cursor` continues from the previous page.

The Web `/audit` page sends these audit filters to `/api/audit-events` server-side. Its tool-call status filter is Web-only for `/api/tool-call-events`.

Gateway-observed audit events can be copied into the Control Plane API skeleton with:

```txt
POST /api/audit-events/gateway
```

The route is protected by the existing platform-admin auth check. It preserves Gateway metadata such as `traceId`, `riskLevel`, redacted arguments, argument hash, latency, upstream status, and error code so Web `/audit` can surface Gateway-observed MCP activity through the normal audit search endpoint. This is still in-memory only and does not add durable persistence or external forwarding.

Example audit query:

```sh
curl 'http://localhost:4000/api/audit-events?from=2026-06-07T00:00:00Z&to=2026-06-07T23:59:59Z&policy_decision=deny&risk_level=high&limit=25'
```

## Metrics

The API exposes Prometheus text at `/metrics`.

- `mcp_api_requests_total`

Example:

```sh
curl http://localhost:4000/metrics
```

The Gateway exposes Prometheus text at `/metrics`.

- `mcp_gateway_requests_total`
- `mcp_gateway_request_duration_ms`
- `mcp_gateway_tool_calls_total`
- `mcp_gateway_tool_call_duration_ms`
- `mcp_gateway_policy_denies_total`
- `mcp_gateway_upstream_errors_total`
- `mcp_gateway_active_sessions`

Example:

```sh
curl http://localhost:5000/metrics
```

The Worker has a metrics helper for local instrumentation and tests, plus a lightweight `createWorkerServer()` helper that serves Prometheus text at `GET /metrics`.

- `mcp_worker_scan_total`
- `mcp_worker_schema_changes_total`

Worker schema-diff jobs increment `mcp_worker_schema_changes_total` by `1` when the skeleton detects a schema change. The Worker also keeps in-memory audit events for `schema.changed` and `health.changed`, preserving `traceId`, `serverId`, timestamp, outcome, and basic metadata.

Emergency deny changes are represented in API audit events as `emergency_policy.enabled` and `emergency_policy.disabled`.

## Metric Label Policy

Metric labels must stay low-cardinality. Labels should describe bounded operational dimensions such as method, route, status family, outcome, policy decision, job kind, or result category.

Do not use these values in metric labels:

- `user_id`
- `trace_id`
- server slug or server id
- tool name
- session id
- raw arguments

Put high-cardinality or sensitive values in audit events after redaction where appropriate, not in metric labels.

## Trace Propagation

Requests may provide `x-trace-id`. If it is missing, the API or Gateway creates one.

- The API stores the trace id on the request, returns it in the response header, logs it, and stores it in audit events created by API actions.
- The Gateway returns `x-trace-id` in the response header, records it in Gateway audit events, and forwards it upstream as `x-trace-id` when proxying MCP JSON-RPC calls.
- Audit searches can filter by `trace_id` to connect API actions, Gateway decisions, and upstream calls that share the same trace.

Example Gateway request with a trace header:

```sh
curl http://localhost:5000/mcp/k8s-readonly \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -H 'x-trace-id: local-trace-001' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## OpenTelemetry Hook Scope

The shared logger package includes a lightweight `withSpan` helper. It starts a span, attaches simple attributes, records exceptions, and ends the span around a callback.

This is only a code hook. The current skeleton does not include an OpenTelemetry collector, exporter, backend, sampling policy, or deployment stack.

## Operator Triage

Use these commands and pages during incidents:

```sh
curl http://localhost:4000/healthz
curl http://localhost:4000/readyz
curl http://localhost:5000/metrics
curl 'http://localhost:4000/api/audit-events?limit=25'
curl 'http://localhost:4000/api/audit-events?policy_decision=deny&limit=25'
```

Web pages:

| Page | Use |
| --- | --- |
| `/audit` | Search policy, admin, and ingested Gateway audit events. |
| `/operations` | Inspect server health records from the API skeleton. |
| `/servers/:serverId` | Correlate one server's versions, tools, health, and recent audit event. |
| `/admin` | Apply kill-switch actions when audit shows active impact. |

Current audit and health data is in memory. Preserve running API and Gateway processes during investigation if you need their current in-memory evidence.
