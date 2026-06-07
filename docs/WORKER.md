# Worker

The Worker runs from `apps/worker/cmd/worker` and listens on `:4100` by default.

Supported jobs:

- MCP server health check
- tools/list scan
- resources/list scan
- prompts/list scan
- schema snapshot
- schema diff
- runtime reconcile
- secret lease renewal
- stale session cleanup
- audit retention cleanup
- audit export

Manual trigger:

```sh
curl -X POST http://localhost:4100/jobs/run \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer dev-admin-token' \
  -d '[{"kind":"runtime-reconcile","targetServerId":"00000000-0000-4000-8000-000000000102","manifestPath":"servers/k8s/mcp-server.manifest.json"}]'
```

`/jobs/run` requires a platform-admin bearer token in local mock mode or a service token configured through `MCP_WORKER_JOB_TOKEN`. The request body must be a JSON job array; malformed JSON, trailing JSON values, and JSON `null` are rejected. The scheduled worker loop runs without the HTTP trigger token.

`runtime-reconcile` validates an MCP server manifest, renders Deployment/Service/ServiceAccount/NetworkPolicy objects, persists admin-only `GET /api/runtime/status` data, and issues reference-only secret lease metadata. It does not apply resources to a live cluster in this skeleton; status phase is render state, not pod readiness.

Each job records a result. Job failures are returned as failed job results and do not kill the Worker process.

`schema-snapshot` records the current Store-backed tool schemas for the target server. `schema-diff` compares supplied previous/current snapshots when present, stores added/removed/changed/risk-change metadata, and marks approval-required diffs for API history lookup.

Audit export jobs accept `from`, `to`, `redacted`, and `signed` fields. They record `audit.export.completed` with export id, count, redaction status, and signing status. Signed worker exports require the same `MCP_COMPLIANCE_EXPORT_SIGNING_KEY` used by the API.

```sh
curl -X POST http://localhost:4100/jobs/run   -H 'content-type: application/json'   -d '[{"kind":"audit-export","targetServerId":"00000000-0000-4000-8000-000000000102","from":"2026-06-07T00:00:00Z","to":"2026-06-08T00:00:00Z"}]'
```

Prompt scan jobs now inspect tool metadata for prompt-injection phrases and record quarantine recommendations.
