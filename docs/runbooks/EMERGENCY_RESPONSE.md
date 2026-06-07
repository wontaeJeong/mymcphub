# Emergency Response Runbook

Use this runbook for kill switch, server quarantine, audit verification, and rollback during an MCP Hub security incident.

## Kill Switch

Enable emergency deny through the Control Plane API or an API-backed admin UI. Avoid direct DB, Kubernetes, or Secret Store mutation.

```sh
curl -X POST http://localhost:4000/api/admin/emergency-deny \
  -H 'content-type: application/json' \
  -d '{"reason":"security incident","global":true}'
```

## Quarantine

```sh
go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 server quarantine <server-id>
```

Verify the Gateway denies traffic before upstream execution:

```sh
curl http://localhost:5000/mcp/<server-slug> \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Audit Verification

```sh
go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 --output json audit search --server <server-id> --policy-decision deny
go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 --output json audit export --from <start-rfc3339> --to <end-rfc3339> --server <server-id> --signed
```

Signed export requires `MCP_COMPLIANCE_EXPORT_SIGNING_KEY` on the API process.

## Rollback

Roll back to a known-good image digest or GitOps revision. Do not roll forward from mutable tags during an active incident.

```sh
helm rollback mcp-hub <revision> --namespace mcp-hub
```

After rollback, recheck API readiness, Gateway denies/allows, and audit export. Disable emergency deny only after the affected server is clean or remains quarantined.
