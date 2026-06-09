# Deployment

The Helm chart deploys Web, API, and Worker only. It expects an external PostgreSQL connection secret and admin/read token secrets.

```sh
helm lint deploy/helm/mcp-hub
helm template mcp-hub deploy/helm/mcp-hub
```

Images should run as non-root with read-only root filesystems. API/Web are stateless. Worker defaults to one replica to avoid duplicate sync; future scale-out should add DB advisory locking around sync jobs.
