# Contracts

`schemas/` is the language-neutral source of truth.

- `schemas/openapi/mcp-hub.openapi.yaml` describes the Control Plane API.
- `schemas/openapi/control-plane.openapi.json` is generated from the Go runtime OpenAPI document by `scripts/gen/openapi.sh` and checked for drift.
- `schemas/jsonschema/mcp-server.schema.json` validates first-party server manifests.
- `schemas/jsonschema/policy.schema.json` validates policy decisions.
- `schemas/jsonschema/audit-event.schema.json` validates audit events.
- `schemas/jsonschema/grant-request.schema.json` validates grant request payloads.
- `schemas/jsonschema/client-profile.schema.json` validates generated client profile output.

The standard error envelope is:

```json
{
  "error": { "code": "VALIDATION_ERROR", "message": "message", "details": {} },
  "traceId": "request-trace-id"
}
```

Pagination uses `items` plus optional `pageInfo.limit` and `pageInfo.nextCursor`. Mutation endpoints are marked with `x-audit-event-required: true` in OpenAPI. The generated Web boundary at `apps/web/lib/generated/mcp-hub-client.ts` includes the current OpenAPI path list and shared request/error helpers.

Generation checks:

```sh
scripts/gen/openapi.sh --check
scripts/gen/schemas.sh --check
```

Run `scripts/gen/openapi.sh` after changing `internal/controlplane/server.go` or `schemas/openapi/mcp-hub.openapi.yaml` to refresh `schemas/openapi/control-plane.openapi.json`.
