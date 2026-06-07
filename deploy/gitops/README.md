# GitOps

GitOps manifests for MCP Hub are organized as a Kustomize base plus environment overlays:

```txt
base/
  kustomization.yaml
  namespace.yaml
overlays/
  dev/kustomization.yaml
  stg/kustomization.yaml
  prod/kustomization.yaml
```

Each overlay uses Kustomize `helmCharts` to render the local `deploy/helm/mcp-hub` chart with inline overrides that match the environment values file. The small local `values.yaml` files keep Kustomize load restrictions satisfied while the chart defaults still come from Helm. Argo CD or Flux can use the same overlays when Helm support is enabled in Kustomize.

Release promotion is documented in [docs/RELEASE.md](../../docs/RELEASE.md). Promote dev to stg to prod by carrying the same component image digests through the target overlays, then confirm API version metadata after sync.

Validate an overlay with:

```sh
kustomize build --enable-helm deploy/gitops/overlays/dev
kustomize build --enable-helm deploy/gitops/overlays/stg
kustomize build --enable-helm deploy/gitops/overlays/prod
```

Kustomize Helm rendering currently expects a Helm v3-compatible binary.

The overlays do not define plaintext secret data. Provision the referenced database, Redis, and OIDC client secret values through your cluster secret workflow before syncing.

The Helm chart also includes a disabled canary placeholder under `rollout.canary`. The current overlays do not render traffic splitting resources.
