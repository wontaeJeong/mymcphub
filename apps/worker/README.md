# Worker

Go background worker service.

```sh
go run ./apps/worker/cmd/worker
curl -X POST http://localhost:4100/jobs/run \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer dev-admin-token' \
  -d '[{"kind":"health-check","targetServerId":"00000000-0000-4000-8000-000000000100"}]'
```
