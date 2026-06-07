# Runbooks

## Gateway Outage

Check `/healthz`, `/readyz`, `/metrics`, recent Gateway audit denies, and upstream circuit state through `GET /mcp/{serverSlug}` with a valid token. Roll back only to a previous Go Gateway image tag or digest.

## Upstream MCP Outage

Check Gateway audit events for `UPSTREAM_*` errors, verify the registered upstream URL, and inspect the target MCP server health endpoint. Circuit-breaker degraded state clears after successful upstream calls.

## Auth Outage

Confirm bearer token handling at the Gateway and trusted identity headers at the API. Missing Gateway bearer tokens must continue returning `401`.

## Policy Deny Spike

Search audit events by `policy_decision=deny`, identify `reasonCode`, and compare grants with requested tools. Do not bypass policy with direct DB updates.

## Schema Drift

Run Worker schema-diff jobs and review approval-required changes. Schema diff must not auto-publish a server version.

## Server Quarantine

Run `mcphubctl server quarantine <server>` or use the Web admin surface. Verify Gateway traffic is denied before upstream calls and audit records are emitted.
