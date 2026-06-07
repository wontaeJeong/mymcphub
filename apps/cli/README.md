# mcphubctl

Go operator CLI for MCP Hub.

```sh
go run ./apps/cli/cmd/mcphubctl version
go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 health
go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 client config --client opencode --output json
```

The CLI talks to the Control Plane API and does not directly mutate DB, Kubernetes, or secrets.

See also:

- [Local Development](../../docs/LOCAL_DEV.md)
- [MVP Demo](../../docs/MVP_DEMO.md)
- [CLI](../../docs/CLI.md)
