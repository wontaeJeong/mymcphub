# Deployment

MCP Hub can be deployed with Helm directly or through the Kustomize GitOps overlays in `deploy/gitops`. The chart is intentionally application only: PostgreSQL and Redis are external by default, with optional placeholder Services for clusters that want to wire their own backing services later. See [RELEASE.md](RELEASE.md) for dev to stg to prod promotion, digest usage, API version metadata checks, canary placeholder behavior, and rollback.

## Chart Contents

The chart in `deploy/helm/mcp-hub` renders these Kubernetes resources:

- Web Deployment and Service on port `3000`.
- API Deployment and Service on port `4000` with `/healthz`, `/readyz`, and `/metrics` support.
- Gateway Deployment and Service on port `5000`; probes default to TCP because the current gateway has no `/healthz` endpoint.
- Worker Deployment with HTTP probes disabled by default because the current worker entrypoint runs once and does not listen by default.
- Ingress for web, API, and gateway routes.
- ConfigMap for non-secret runtime configuration.
- Secret placeholder documenting required external Secrets.
- Separable ServiceAccounts, pod and container security contexts, resource requests and limits, NetworkPolicy, and optional ServiceMonitor.
- Optional PostgreSQL and Redis placeholder Services when explicitly enabled.

## Values Matrix

| File | Image tag | Replicas | Public URL | Log level | Intended use |
| --- | --- | --- | --- | --- | --- |
| `values.yaml` | `latest` | web 2, api 2, gateway 2, worker 1 | `https://mcp-hub.example.com` | `info` | Baseline defaults |
| `values-dev.yaml` | `dev` | web 1, api 1, gateway 1, worker 1 | `https://mcp-hub-dev.example.com` | `debug` | Development cluster |
| `values-stg.yaml` | `stg` | web 2, api 2, gateway 2, worker 1 | `https://mcp-hub-stg.example.com` | `info` | Staging cluster |
| `values-prod.yaml` | `prod` | web 3, api 3, gateway 3, worker 1 | `https://mcp-hub.example.com` | `info` | Production cluster |

Key values follow this structure:

- `image.registry`, `image.repositoryPrefix`, `image.tag`, and `image.pullPolicy` select images such as `registry.example.com/mcp-hub/api:dev`. Set each component image digest, such as `api.image.digest` or `web.image.digest`, in shared and production environments to render digest pinned image references such as `registry.example.com/mcp-hub/api@sha256:...`. A component digest overrides tag rendering for that component.
- `web`, `api`, `gateway`, and `worker` each expose `enabled`, `replicas`, `port`, `serviceAccountName`, resources, and probe settings.
- `auth.mode`, `auth.oidcIssuerUrl`, and `auth.audience` populate non-secret auth runtime config. Use `mock` only for local/dev skeletons. Current `oidc` mode consumes OIDC-compatible identity headers, so shared environments must place the API behind a trusted auth proxy or ingress that verifies identity and strips client-supplied identity headers before injecting trusted values.
- `postgres.external` and `redis.external` point to existing Secrets for connection URLs.
- `ingress`, `networkPolicy`, `runtime`, `serviceAccount`, and `serviceMonitor` control cluster integration and hardening. Keep pod `automountServiceAccountToken` disabled unless a component explicitly needs Kubernetes API access.
- `rollout.canary` is a disabled placeholder. The chart does not render traffic splitting resources yet.

## Secret Expectations

Do not put plaintext secrets in Helm values, Kustomize patches, Git, or documentation examples. The chart reads sensitive values only through `secretKeyRef` entries:

| Environment variable | Default Secret name | Default key |
| --- | --- | --- |
| `DATABASE_URL` | `mcp-hub-db` | `databaseUrl` |
| `REDIS_URL` | `mcp-hub-redis` | `redisUrl` |
| `OIDC_CLIENT_SECRET` | `mcp-hub-oidc` | `clientSecret` |

Create these Secrets with your approved cluster secret workflow before installing or syncing. External secret controllers, sealed secrets, or manually created namespace Secrets are all compatible as long as the names and keys match the selected values.

Non-secret config is rendered in a ConfigMap: `NODE_ENV`, `LOG_LEVEL`, `MCP_AUTH_MODE`, `OIDC_ISSUER_URL`, `OIDC_AUDIENCE`, `OIDC_CLIENT_ID`, `MCP_HUB_PUBLIC_URL`, `MCP_API_URL`, and `MCP_GATEWAY_URL`. The web chart also exposes `NEXT_PUBLIC_MCP_API_URL` with the same API URL.

## Helm Install And Upgrade

Render the defaults before applying:

```sh
helm lint deploy/helm/mcp-hub
helm template mcp-hub deploy/helm/mcp-hub --namespace mcp-hub
```

Install or upgrade an environment:

```sh
helm upgrade --install mcp-hub deploy/helm/mcp-hub \
  --namespace mcp-hub \
  --create-namespace \
  -f deploy/helm/mcp-hub/values-dev.yaml
```

Use `values-stg.yaml` or `values-prod.yaml` for staging or production. Override image tags from CI with `--set image.tag=<tag>` rather than editing committed values for temporary releases. Prefer component digests such as `--set api.image.digest=sha256:<digest>` for production after images are scanned and signed. The full promotion path is documented in [RELEASE.md](RELEASE.md).

## Runtime Hardening Notes

The default chart enables non-root pods, read-only root filesystems, dropped Linux capabilities, `RuntimeDefault` seccomp, resource requests and limits, NetworkPolicy resources, separate ServiceAccounts, and pod-level `automountServiceAccountToken: false`. Staging and production values set `networkPolicy.allowExternalEgress=false`; keep broad egress disabled unless approved destinations are modeled elsewhere, grant ServiceAccounts only the minimum RBAC required outside this chart, and pin images by digest.

## Auth Trust Boundary

The current API skeleton does not verify JWTs directly at runtime. In `oidc` mode it accepts OIDC-compatible identity headers such as `x-user-id`, `x-team-ids`, `x-groups`, `x-roles`, `x-principal-type`, and `x-client-id`. Do not expose the API directly in shared environments unless a trusted ingress or auth proxy verifies the upstream identity, strips any client-supplied identity headers, and injects trusted headers for the API to consume.

See [SECURITY.md](SECURITY.md) for scanner commands, Dockerfile and Kubernetes hardening review, MCP manifest review, secret handling, and kill-switch operation endpoints.

## Rollback

List release history and roll back to a known-good revision:

```sh
helm history mcp-hub --namespace mcp-hub
helm rollback mcp-hub <revision> --namespace mcp-hub
```

After rollback, confirm the generated configuration still points at the expected external Secrets and image tag or digest. Also compare API version metadata with the intended rollback target as described in [RELEASE.md](RELEASE.md).

## GitOps Usage

The Kustomize overlays render the local Helm chart and are suitable for Argo CD or Flux when Kustomize Helm support is enabled. The overlays use inline values matching `values-dev.yaml`, `values-stg.yaml`, and `values-prod.yaml`, plus a local empty `values.yaml` file so default Kustomize load restrictions do not need to read values files outside the overlay directory.

Validate overlays locally:

```sh
kustomize build --enable-helm deploy/gitops/overlays/dev
kustomize build --enable-helm deploy/gitops/overlays/stg
kustomize build --enable-helm deploy/gitops/overlays/prod
```

Kustomize Helm rendering currently expects a Helm v3-compatible binary. Direct Helm rendering of the chart works with the installed Helm client as long as the chart validates with `helm lint` and `helm template`.

Argo CD applications should point at one overlay path, such as `deploy/gitops/overlays/prod`, and enable Helm rendering for Kustomize. Flux Kustomizations should use the same overlay path with Helm support enabled in the controller configuration.

## Validation Commands

Run these checks before opening a deployment change:

```sh
helm lint deploy/helm/mcp-hub
helm template mcp-hub deploy/helm/mcp-hub --namespace mcp-hub
helm template mcp-hub deploy/helm/mcp-hub --namespace mcp-hub -f deploy/helm/mcp-hub/values-dev.yaml
helm template mcp-hub deploy/helm/mcp-hub --namespace mcp-hub -f deploy/helm/mcp-hub/values-stg.yaml
helm template mcp-hub deploy/helm/mcp-hub --namespace mcp-hub -f deploy/helm/mcp-hub/values-prod.yaml
kustomize build --enable-helm deploy/gitops/overlays/dev
kustomize build --enable-helm deploy/gitops/overlays/stg
kustomize build --enable-helm deploy/gitops/overlays/prod
```

Also inspect the rendered manifests for `NetworkPolicy`, `Ingress`, `secretKeyRef` entries, security contexts, resource limits, and probe behavior before syncing to a shared cluster.
