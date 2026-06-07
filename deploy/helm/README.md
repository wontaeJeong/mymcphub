# Helm

The production-facing MCP Hub chart is in `mcp-hub/`. It deploys the web, API, gateway, and worker components with Services for web/API/gateway, Ingress, ConfigMap, secret placeholder, separable ServiceAccounts, NetworkPolicy, optional PostgreSQL and Redis placeholders, and an optional ServiceMonitor.

Render or install the chart with one of the environment values files:

```sh
helm lint deploy/helm/mcp-hub
helm template mcp-hub deploy/helm/mcp-hub --namespace mcp-hub
helm template mcp-hub deploy/helm/mcp-hub --namespace mcp-hub -f deploy/helm/mcp-hub/values-dev.yaml
helm upgrade --install mcp-hub deploy/helm/mcp-hub --namespace mcp-hub --create-namespace -f deploy/helm/mcp-hub/values-dev.yaml
```

The chart does not store plaintext secret values in Helm values. `DATABASE_URL`, `REDIS_URL`, and `OIDC_CLIENT_SECRET` are referenced only through `secretKeyRef`; create those Secrets outside this chart or with an external secret controller.
