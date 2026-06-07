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
  -d '{"client":"opencode","serverId":"00000000-0000-4000-8000-000000000100"}'
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

Mutations require a platform-admin auth context and write audit events.
