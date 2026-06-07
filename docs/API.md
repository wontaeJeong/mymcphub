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

- Catalog: `/api/servers`, `/api/servers/{serverId}`, publish, unpublish, enable, disable, quarantine.
- Versions: `/api/servers/{serverId}/versions`, activate, rollback, schema diff.
- Tools: list, patch, enable, disable, schema lookup.
- Grants and approvals: list, request/create, approve, revoke/reject.
- Policy: validate, simulate, test-call.
- Audit: search and export.
- Admin: emergency deny and revoke server grants.
- Health/readiness/metrics/OpenAPI.

Mutations require a platform-admin auth context and write audit events.
