# Control Plane API

The Control Plane API runs from `apps/api/cmd/api` and listens on `:4000` by default.

## Local Checks

```sh
go run ./apps/api/cmd/api
curl http://localhost:4000/healthz
curl http://localhost:4000/readyz
curl http://localhost:4000/api/me
curl http://localhost:4000/api/servers
curl -X POST http://localhost:4000/api/client-config/generate \
  -H 'content-type: application/json' \
  -d '{"client":"opencode","serverId":"00000000-0000-4000-8000-000000000102"}'
```

## Route Groups

- Catalog: `/api/servers`, `/api/servers/{serverId}`, delete, publish, unpublish, enable, disable, quarantine, with pagination and filters on environment, risk, owner team, transport, enabled, published, and text query.
- Versions and rollout: `/api/servers/{serverId}/versions`, activate, rollback, and `/api/servers/{serverId}/rollout` for active version, pending versions, rollback targets, image digest, and GitOps metadata.
- Tools: list, patch, enable, disable, schema lookup.
- Grants and approvals: list, request/create, approve, revoke/reject.
- Schema history: `/api/servers/{serverId}/schema-diff`, `/api/servers/{serverId}/schema-diff/history`, and `/api/servers/{serverId}/schema-snapshots`.
- Secret bindings: `/api/secret-bindings` stores provider refs and lease metadata only; plaintext secret values are rejected.
- Tenancy: `/api/tenancy/users`, `/api/tenancy/teams`, `/api/tenancy/projects`, membership routes, and `/api/tenancy/policy-input`.
- Policy: validate, simulate, test-call.
- Audit: search, redacted export payloads, and audit export job triggers.
- Admin: emergency deny, kill switch, and revoke server grants.
- Health/readiness/metrics/OpenAPI.

Mutations require a platform-admin auth context and write audit events. Version metadata and runtime render endpoints are also platform-admin only because they can include manifest or rendered secret-reference metadata.

## Compliance Export

`GET /api/audit-events/export` returns a redacted compliance export envelope and requires platform-admin access. `from` and `to` are required RFC3339 date-time query parameters. Optional filters match audit search filters, including `server`, `tool`, `policy_decision`, `risk_level`, `user`, `team`, and `project`.

```sh
curl 'http://localhost:4000/api/audit-events/export?from=2026-06-07T00:00:00Z&to=2026-06-08T00:00:00Z&signed=true'
```

Signed exports require `MCP_COMPLIANCE_EXPORT_SIGNING_KEY`; the API returns an HMAC-SHA256 signature over the export envelope.
