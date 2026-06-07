# OpenAPI Schemas

`mcp-hub.openapi.yaml` is the hand-authored Control Plane API contract. `control-plane.openapi.json` is generated from the runtime OpenAPI document and must not be edited by hand.

Regenerate OpenAPI artifacts from the repository root:

```sh
make gen-openapi
```

Check drift with:

```sh
scripts/gen/openapi.sh --check
```
