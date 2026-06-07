# Control Plane API

Go Control Plane API service.

```sh
go run ./apps/api/cmd/api
curl http://localhost:4000/healthz
curl http://localhost:4000/api/servers
```

The service uses `internal/db` for the local in-memory skeleton store and `schemas/openapi/mcp-hub.openapi.yaml` as the API contract.
