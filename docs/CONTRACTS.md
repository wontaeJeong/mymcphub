# Contracts

`schemas/` is the language-neutral source of truth.

- `schemas/openapi/mcp-hub.openapi.yaml` describes the Control Plane API.
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

Pagination uses `items` plus optional `pageInfo.limit` and `pageInfo.nextCursor`. Mutation endpoints are marked with `x-audit-event-required: true` in OpenAPI.

Generation checks:

```sh
scripts/gen/openapi.sh --check
scripts/gen/schemas.sh --check
```
