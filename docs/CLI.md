# mcphubctl

`mcphubctl` is the Go operator CLI in `apps/cli/cmd/mcphubctl`. It calls the Control Plane API and never directly mutates DB, Kubernetes, or secrets.

Examples:

```sh
go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 health
go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 whoami --output json
go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 server list
go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 grant list --output json
go run ./apps/cli/cmd/mcphubctl version
```

Config path: `~/.config/mcphubctl/config.yaml`.
`mcphubctl login` stores the selected API URL and bearer token in that file with `0600` permissions and does not print the token. `MCPHUB_TOKEN` can override the stored token for one-off runs.

Global flags: `--api-url`, `--profile`, `--output table|json|yaml`, `--dry-run`, and `--yes`.

Commands include login/logout/whoami, server, tool, grant, policy, audit, client config/test, health, doctor, version, and shell completion.
