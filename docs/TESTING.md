# Testing

Run:

```sh
make lint
make test
make build
make ci
helm template mcp-hub deploy/helm/mcp-hub
```

Manual QA surfaces:

- API: `curl http://localhost:4000/healthz` and `/api/servers`.
- CLI: `go run ./apps/cli/cmd/mcphubctl version`, `health`, and `server sync-stdio` with a local manifest.
- Web: open `/catalog`, choose a server, and inspect `/servers/{slug}`.
