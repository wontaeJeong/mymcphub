# Worker

The Worker runs from `apps/worker/cmd/worker` and listens on `:4100` by default.

Supported jobs:

- MCP server health check
- tools/list scan
- resources/list scan
- prompts/list scan
- schema snapshot
- schema diff
- stale session cleanup
- audit retention cleanup
- audit export

Manual trigger:

```sh
curl -X POST http://localhost:4100/jobs/run \
  -H 'content-type: application/json' \
  -d '[{"kind":"health-check","targetServerId":"00000000-0000-4000-8000-000000000100"}]'
```

Each job records a result. Job failures are returned as failed job results and do not kill the Worker process.
