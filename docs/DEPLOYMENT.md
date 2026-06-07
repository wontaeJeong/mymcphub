# Deployment

The Helm chart deploys Go images for API, Gateway, Worker, and CLI release artifacts. The Web image remains a TypeScript/Next.js app image.

Render locally:

```sh
helm lint deploy/helm/mcp-hub
helm template mcp-hub deploy/helm/mcp-hub --namespace mcp-hub
bash tests/helm-template.sh
```

Install or upgrade:

```sh
helm upgrade --install mcp-hub deploy/helm/mcp-hub \
  --namespace mcp-hub --create-namespace \
  -f deploy/helm/mcp-hub/values-dev.yaml
```

Use component image digests for shared environments:

```sh
--set api.image.digest=sha256:<api-digest> \
--set gateway.image.digest=sha256:<gateway-digest> \
--set worker.image.digest=sha256:<worker-digest> \
--set web.image.digest=sha256:<web-digest>
```

Do not store plaintext secrets in values. Database, Redis, OIDC client secret, trusted auth-proxy token, and Worker job trigger token values are referenced through Kubernetes Secret refs. For OIDC deployments, set both `auth.trustedHeaderToken.secretName` and `auth.trustedHeaderToken.secretKey`; for manual Worker job triggers, set both `worker.jobToken.secretName` and `worker.jobToken.secretKey`.
