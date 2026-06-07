# Schemas

`schemas/` contains the language-neutral contracts for MCP Hub. Update schemas before changing Go runtime behavior or Web UI consumers.

## OpenAPI

- Human-edited API contract: `schemas/openapi/mcp-hub.openapi.yaml`
- Runtime OpenAPI document: `internal/controlplane/server.go`
- Generated JSON artifact: `schemas/openapi/control-plane.openapi.json`
- Generated Web client boundary: `apps/web/lib/generated/mcp-hub-client.ts`

After changing OpenAPI paths, payloads, or runtime document output, regenerate artifacts:

```sh
make gen-openapi
```

Check for drift:

```sh
scripts/gen/openapi.sh --check
```

## JSON Schema

The files in `schemas/jsonschema/` and `schemas/catalog/mcp-server-manifest.schema.json` are hand-authored source contracts. Edit them directly, then validate that they exist and parse as JSON:

```sh
make gen-schemas
scripts/gen/schemas.sh --check
```

## Combined Contract Check

Run the full schema lane with:

```sh
make schema
scripts/ci/schemas.sh
```

See [Contracts](../docs/CONTRACTS.md) for the API envelope and generated boundary expectations.
