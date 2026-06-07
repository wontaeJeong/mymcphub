# Generated Web API Boundary

Files in this directory are generated from the Control Plane OpenAPI contract.

Do not edit `mcp-hub-client.ts` by hand. Change the source contract or runtime OpenAPI document instead:

- `schemas/openapi/mcp-hub.openapi.yaml`
- `internal/controlplane/server.go`

Regenerate the Web boundary and OpenAPI JSON artifact from the repository root:

```sh
make gen-openapi
```

Check generated artifacts for drift:

```sh
scripts/gen/openapi.sh --check
```

Application code should import this boundary instead of duplicating Control Plane API path or error-envelope shapes.
