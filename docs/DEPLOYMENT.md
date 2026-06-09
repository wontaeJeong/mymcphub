# Deployment

The Helm chart deploys Go images for API, Gateway, Worker, and CLI release artifacts. The Web image remains a TypeScript/Next.js app image.

Render locally:

```sh
helm lint deploy/helm/mcp-hub
helm template mcp-hub deploy/helm/mcp-hub --namespace mcp-hub
bash scripts/ci/helm-template.sh
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

## Corporate TLS and proxy behavior

Production deployments are expected to run only on the internal network, so the Helm chart intentionally does not inject `HTTP_PROXY` or `HTTPS_PROXY` into runtime pods. Build-time proxy support belongs to the Docker build args documented in `docs/LOCAL_DEV.md`.

Corporate CA trust can be supplied in either of these ways:

1. Bake approved PEM `.crt` files into images by placing them in `deploy/certs/` before image build. The Dockerfiles install `ca-certificates`, copy that directory into build and runtime stages, and refresh the image trust store when a non-empty `.crt` exists.
2. Mount a Kubernetes Secret at runtime for cluster-managed CA rotation. Create a Secret containing the PEM bundle and enable `corporateCa` values:

```sh
kubectl create secret generic mcp-hub-corporate-ca \
  --namespace mcp-hub \
  --from-file=ca.crt=/path/to/corporate-ca.crt

helm upgrade --install mcp-hub deploy/helm/mcp-hub \
  --namespace mcp-hub --create-namespace \
  -f deploy/helm/mcp-hub/values-prod.yaml \
  --set corporateCa.enabled=true \
  --set corporateCa.secretName=mcp-hub-corporate-ca
```

When `corporateCa.enabled=true`, the chart mounts the Secret as a read-only directory and sets `SSL_CERT_FILE` plus `NODE_EXTRA_CA_CERTS` to the mounted certificate path for API, Gateway, Worker, and Web pods.

Do not store plaintext secrets in values. Database, Redis, OIDC client secret, trusted auth-proxy token, and Worker job trigger token values are referenced through Kubernetes Secret refs. For OIDC deployments, set both `auth.trustedHeaderToken.secretName` and `auth.trustedHeaderToken.secretKey`; for manual Worker job triggers, set both `worker.jobToken.secretName` and `worker.jobToken.secretKey`.
