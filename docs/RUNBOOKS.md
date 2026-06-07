# Runbooks

Use this file first during common incidents. It is the quick runbook index and triage entrypoint for Gateway, upstream MCP, auth, policy, observability, schema drift, and quarantine response.

For detailed operational procedures, follow the matching section in [MCP Hub Runbook](RUNBOOK.md). For topic-specific emergency or deep-dive material, use the files under [docs/runbooks/](runbooks/), starting with [Emergency Response Runbook](runbooks/EMERGENCY_RESPONSE.md) during security incidents.

## Gateway Outage

Check `/healthz`, `/readyz`, `/metrics`, recent Gateway audit denies, and upstream circuit state through `GET /mcp/{serverSlug}` with a valid token. Roll back only to a previous Go Gateway image tag or digest.

## Upstream MCP Outage

Check Gateway audit events for `UPSTREAM_*` errors, verify the registered upstream URL, and inspect the target MCP server health endpoint. Circuit-breaker degraded state clears after successful upstream calls.

## Auth Outage

Confirm bearer token handling at the Gateway and trusted identity headers at the API. Missing Gateway bearer tokens must continue returning `401`.

## Policy Deny Spike

Search audit events by `policy_decision=deny`, review admin-only `GET /api/analytics/denied-calls`, identify `errorCode`, and compare grants with requested tools. Do not bypass policy with direct DB updates.

## Observability Alerts

The Helm chart can render `MCPHubGatewayErrorRateHigh`, `MCPHubAuthFailuresHigh`, `MCPHubUpstreamFailuresHigh`, and `MCPHubWorkerLagHigh` Prometheus alerts. Start with `/metrics`, `/operations`, `/audit`, and admin-only `GET /api/analytics/denied-calls`, then follow the matching detailed section in `docs/RUNBOOK.md`.

## Schema Drift

Run Worker schema-diff jobs and review approval-required changes. Schema diff must not auto-publish a server version.

## Server Quarantine

Run `mcphubctl server quarantine <server>` or use the Web admin surface. Verify Gateway traffic is denied before upstream calls and audit records are emitted.

## Emergency Kill Switch And Quarantine

1. Enable emergency deny with the API or CLI-backed admin surface. Do not patch the database or Kubernetes resources directly.
2. Quarantine the affected server with `mcphubctl server quarantine <server-id>`.
3. Verify Gateway calls return policy deny before upstream execution.
4. Search audit with `mcphubctl --output json audit search --policy-decision deny --server <server-id>`.
5. Export evidence with `mcphubctl --output json audit export --from <start> --to <end> --server <server-id> --signed` when a signing key is configured.
6. Roll back only to a known-good image digest or Helm/GitOps revision, then disable emergency deny after Gateway and audit checks are clean.
