# Release

This guide covers MCP Hub release promotion from development to staging to production. It pairs Helm image selection, API version metadata, worker schema checks, GitOps promotion, and rollback into one repeatable path.

## Versioning Targets

Track each release with these targets:

| Target                         | Purpose                                               | Expected source                        |
| ------------------------------ | ----------------------------------------------------- | -------------------------------------- |
| Release version                | Human readable release identity                       | SemVer tag or CI release name          |
| Component image tag            | Mutable build pointer for dev and early staging tests | CI image tag                           |
| Component image digest         | Immutable runtime identity for staging and production | Registry digest after scan and signing |
| Helm values or GitOps revision | Cluster config identity                               | Chart values file or overlay commit    |
| API version metadata           | Runtime proof of what the server is running           | Deployed API metadata response         |

Use tags to find and test a candidate quickly. Use digests when promoting a known image between shared environments.

## Server Version Metadata

The deployed API should report release metadata that operators can compare with the intended release record. At a minimum, the release check should confirm the API reports the expected release version and source revision. When image metadata is available, compare the reported component image or digest with the Helm values used for the deployment.

Record the API metadata result during each promotion. If the API reports an older release after Helm or GitOps reports success, treat the rollout as incomplete and inspect Deployment status, pod readiness, and image references before moving on.

## Worker Schema Diff Scope

The worker schema diff is a release guard for MCP tool contract changes. Its scope is the discovered tool input and output schemas stored for MCP catalog entries, including schema hashes and versioned snapshots.

Use this check to spot added, removed, or changed MCP tool schemas before production. It is not a database migration checker, OpenAPI compatibility checker, auth policy review, UI regression test, or secret validation step. Review high risk tool changes with the owning team even when the automated schema diff is clean.

## Control Plane Version Endpoints

The API skeleton includes these Control Plane endpoints for server version metadata and schema diff review:

- `GET /api/servers/:serverId/versions`
- `POST /api/servers/:serverId/versions`
- `POST /api/servers/:serverId/versions/:versionId/activate`
- `POST /api/servers/:serverId/versions/:versionId/rollback`
- `GET /api/servers/:serverId/schema-diff`

These endpoints currently manage in-memory control-plane metadata in the API skeleton. They do not perform Kubernetes or Helm deployment actions, and they do not persist API version metadata or schema diff state to Postgres.
Version list responses are platform-admin only because version records can include reviewed manifest metadata. `manifestJson` payloads are validated against the runtime manifest contract before storage.

## Promotion Flow, Dev To Stg To Prod

1. Build component images for `web`, `api`, `gateway`, and `worker` from the same source revision.
2. Deploy the candidate to dev with the environment values file and a CI tag, for example `--set image.tag=<candidate>`.
3. Run release validation in dev, including API version metadata, worker schema diff review, smoke tests, and Helm rendering.
4. After image scanning and signing, capture the registry digest for each component.
5. Promote the same component digests to staging. Do not rebuild between dev and staging unless the release candidate is rejected.
6. Validate staging with the same checks and compare API version metadata with the release record.
7. Promote the same digests to production after staging approval.
8. Record the production Helm revision or GitOps sync revision, API metadata response, and component digests.

## Helm Tag And Digest Usage

The chart builds component image references from the global image settings and the component repository name. Without a component digest, images render with `image.tag`:

```sh
helm template mcp-hub deploy/helm/mcp-hub \
  --namespace mcp-hub \
  --set image.tag=2026.06.07.1
```

Set component digests for immutable promotion:

```sh
helm upgrade --install mcp-hub deploy/helm/mcp-hub \
  --namespace mcp-hub \
  --create-namespace \
  -f deploy/helm/mcp-hub/values-prod.yaml \
  --set web.image.digest=sha256:<web-digest> \
  --set api.image.digest=sha256:<api-digest> \
  --set gateway.image.digest=sha256:<gateway-digest> \
  --set worker.image.digest=sha256:<worker-digest>
```

When a component digest is set, the chart renders `registry.example.com/mcp-hub/<component>@sha256:...` and does not render the tag for that component. This preserves the existing Helm helper behavior and lets each component move to digest promotion at its own pace.

## SBOM And Signing Evidence

Generate SBOMs and cosign evidence for immutable images before promotion:

```sh
SECURITY_IMAGES=registry.example.com/mcp-hub/api@sha256:<digest> pnpm security:sbom
```

Use `SECURITY_SIGN_IMAGES=1` to sign images and `SECURITY_ATTEST_SBOM=1` to attach Syft CycloneDX SBOMs as cosign attestations when registry credentials or keyless identity are configured. Keep generated SBOMs with the release record.

## GitOps Digest Promotion

For Argo CD or Flux, promote by changing the overlay values that feed the Helm chart, then sync the target environment. Keep the same digest values when moving from staging to production unless a new release candidate is approved.

GitOps promotion should include the target environment, component digest set, release version, and the API metadata observed after sync. Avoid committing plaintext secrets or registry credentials. Secret values still come from the cluster secret workflow described in [DEPLOYMENT.md](DEPLOYMENT.md).

## Canary Placeholder

`values.yaml` includes `rollout.canary.enabled` and `rollout.canary.weight` as disabled placeholders. They are documentation and future configuration only. The chart does not render traffic splitting resources, weighted Services, service mesh routes, Argo Rollouts, or Flagger objects.

Keep `rollout.canary.enabled=false` until real canary routing is designed, reviewed, and implemented in chart templates. Changing `weight` today has no effect on rendered Kubernetes resources.

## Rollback

Use three rollback signals together:

| Signal          | Use                                                                     |
| --------------- | ----------------------------------------------------------------------- |
| API metadata    | Confirm the runtime version before and after rollback                   |
| Helm revision   | Return a direct Helm deployment to a known good chart and values render |
| GitOps revision | Revert or resync the overlay revision used by Argo CD or Flux           |

For direct Helm deployments:

```sh
helm history mcp-hub --namespace mcp-hub
helm rollback mcp-hub <revision> --namespace mcp-hub
```

After rollback, check pod readiness, rendered image references, and API version metadata. If the rollback changes only tags and not digests, confirm the tag still points at the expected image before declaring recovery complete.

For GitOps deployments, revert the environment overlay to the previous digest set or sync the previous Git revision. Confirm the controller has applied the rollback, then run the same API metadata and image reference checks.

## Validation Commands

Run Helm rendering before opening or promoting a release change:

```sh
pnpm helm:template
```

Use a digest override render to confirm immutable image references:

```sh
helm template mcp-hub deploy/helm/mcp-hub \
  --namespace mcp-hub \
  --set api.image.digest=sha256:1111111111111111111111111111111111111111111111111111111111111111
```

Inspect the rendered API Deployment image and confirm it uses `@sha256:` rather than `:<tag>` for that component. Repeat for each component when changing digest behavior.

Generate Markdown release notes before handoff:

```sh
pnpm release:notes -- \
  --version 0.1.0 \
  --revision "$(git rev-parse HEAD)" \
  --image-digest api=sha256:1111111111111111111111111111111111111111111111111111111111111111 \
  --cli-artifacts "mcphubctl darwin/arm64, linux/amd64" \
  --schema-changes "No breaking OpenAPI, JSON Schema, or DB migration changes."
```

The generator renders only local Markdown. It does not publish artifacts, push tags, mutate GitOps overlays, or contact a registry.

For GitOps overlays, validate the selected environment before sync:

```sh
kustomize build --enable-helm deploy/gitops/overlays/dev
kustomize build --enable-helm deploy/gitops/overlays/stg
kustomize build --enable-helm deploy/gitops/overlays/prod
```

## Non Goals

This release slice does not implement real canary routing, Argo Rollouts, Flagger, service mesh traffic splitting, weighted Services, automated production deployment, API Postgres persistence, an external deployment controller, or registry credentials and secret material. Worker support is limited to the pure schema diff helper and placeholder path; it does not add a real runtime MCP scanner.

## Operator Handoff

Before handing a release to operators, include:

| Item      | Evidence                                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| Health    | `curl http://localhost:4000/healthz` and `curl http://localhost:4000/readyz` against the target environment equivalent. |
| Gateway   | `curl http://localhost:5000/metrics` and one approved `/mcp/:serverSlug` check.                                         |
| Helm      | `pnpm helm:template` for chart rendering and `helm history mcp-hub --namespace mcp-hub` for deployed revision context.  |
| Web pages | `/catalog`, `/servers/:serverId`, `/audit`, `/operations`, `/admin`, and `/client-config`.                              |
| Rollback  | Known-good Helm or GitOps revision plus `helm rollback mcp-hub <revision> --namespace mcp-hub` if using direct Helm.    |

Use [RUNBOOK.md](RUNBOOK.md) during release incidents and [CLIENT_SETUP.md](CLIENT_SETUP.md) when client config snippets change.
