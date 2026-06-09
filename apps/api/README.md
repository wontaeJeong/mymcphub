# Control Plane API

Go Control Plane API service.

```sh
go run ./apps/api/cmd/api
curl http://localhost:4000/healthz
curl http://localhost:4000/api/servers
```

The service uses `internal/db` for the runtime repository and `schemas/openapi/mcp-hub.openapi.yaml` as the API contract.

See also:

- [Local Development](../../docs/LOCAL_DEV.md)
- [Control Plane API](../../docs/API.md)
