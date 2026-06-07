# mcphubctl

Go operator CLI for MCP Hub.

```sh
go run ./apps/cli/cmd/mcphubctl version
go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 health
```

The CLI talks to the Control Plane API and does not directly mutate DB, Kubernetes, or secrets.
