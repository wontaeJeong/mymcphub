# API

Read routes:

- `GET /healthz`
- `GET /readyz`
- `GET /api/catalog/summary`
- `GET /api/servers?transport=&status=&environment=&ownerTeam=&q=`
- `GET /api/servers/{serverId}`
- `GET /api/servers/{serverId}/capability-snapshot`
- `GET /api/servers/{serverId}/health`

Admin routes require `Authorization: Bearer $MCPHUB_ADMIN_TOKEN`:

- `POST /api/admin/servers`
- `PATCH /api/admin/servers/{serverId}`
- `DELETE /api/admin/servers/{serverId}`
- `POST /api/admin/servers/{serverId}/sync`
- `POST /api/admin/servers/{serverId}/snapshots`
- `GET /api/admin/audit-events`

Production must set `MCPHUB_ADMIN_TOKEN` and should set a read auth mode/token through the deployment environment.
