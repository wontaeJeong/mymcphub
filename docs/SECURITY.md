# Security

MCP Hub treats MCP server registration and runtime deployment as security-sensitive because tools can expose external system access to agents. Prompt-11 checks are runnable from the repository root and are safe in local or CI environments where optional scanners are not installed.

## Scan Commands

```sh
pnpm security:deps
pnpm security:images
pnpm security:secrets
pnpm security:k8s
pnpm security:mcp-manifests
pnpm security:check
```

The aggregate `pnpm security:check` command runs dependency and filesystem vulnerability checks, container image and Dockerfile checks, secret detection, Kubernetes manifest hardening checks, and MCP manifest risk review.

## Missing Tool Behavior

The shell scanners use optional external tools when they are already installed. They do not install `trivy`, `grype`, `syft`, `gitleaks`, `cosign`, `kube-score`, or `kube-linter`.

Missing tools print `SKIP: <tool> not found` and exit successfully in normal mode so developers and prompt-12 CI can call the scripts before scanner images are wired in. Set `SECURITY_STRICT=1` to make missing tools and review findings fail the shell scanners.

## Vulnerability And SBOM Review

`pnpm security:deps` covers dependency vulnerability, filesystem vulnerability, and SBOM inventory targets:

- `trivy fs` scans committed files and lockfiles for high and critical fixed vulnerabilities when `trivy` is installed.
- `grype dir:.` scans dependency manifests for high and critical fixed vulnerabilities when `grype` is installed.
- `syft dir:.` emits an SBOM inventory when `syft` is installed.
- `SECURITY_PNPM_AUDIT=1 pnpm security:deps` opts into `pnpm audit` where network access and registry policy allow it.

## Container Images And Dockerfiles

`pnpm security:images` covers container image vulnerability, image signature, and Dockerfile hardening targets. Set `SECURITY_IMAGES` to a comma-separated list of image references to scan:

```sh
SECURITY_IMAGES=registry.example.com/mcp-hub/api@sha256:<digest> pnpm security:images
```

The Dockerfile baseline review flags missing base-image digest pinning, missing `USER`, package installs without obvious cache cleanup/no-cache flags, and download-to-shell patterns. Findings are `REVIEW` in normal mode and fail only with `SECURITY_STRICT=1`.

Cosign verification runs only when a verification policy is configured. Set `COSIGN_KEY` for key-based verification, or set both `COSIGN_CERTIFICATE_IDENTITY` and `COSIGN_CERTIFICATE_OIDC_ISSUER` for keyless verification. Without one of those policies, image signature verification is skipped instead of running unqualified trust checks.

## Secret Handling

`pnpm security:secrets` runs `gitleaks git --redact=100` when available and always performs a lightweight committed-secret pattern review. Do not commit plaintext credentials, tokens, private keys, database URLs, Redis URLs, or OIDC client secrets. Helm values and docs must reference Kubernetes Secrets, external secret controllers, or sealed secret workflows instead of containing secret values.

## MCP Manifest Review

`pnpm security:mcp-manifests` checks `servers/*/mcp-server.manifest.json` by default. Pass explicit paths to narrow the target set:

```sh
pnpm security:mcp-manifests -- servers/echo/mcp-server.manifest.json
```

The checker fails manifests missing `slug`, `ownerTeam`, `ownerTeamId`, manifest `riskLevel`, tool `riskLevel`, valid risk levels, object `inputSchema`, `inputSchema.type: object`, or `additionalProperties: false` on tool schemas. High and critical tools must include descriptions.

Dangerous tool and schema keywords are review warnings, not failures: `delete`, `exec`, `shell`, `apply`, `write`, `push`, `merge`, `deploy`, `secret`, `credential`, `token`, `admin`, and `cluster`. High or critical tools also warn for review when `readOnly` is false or missing. Existing non-schema manifest metadata such as `ownerTeam` and tool `readOnly` remains accepted.

## Dangerous Schema Review

Tool schemas must be closed with `additionalProperties: false` to keep agent input contracts explicit. Review any schema properties, enum values, descriptions, or tool names containing dangerous keywords before enabling the server in shared environments. Write, admin, deploy, cluster, secret, credential, and token handling tools require an owner review even when automated checks pass.

## Kubernetes And Helm Runtime Hardening

The Helm chart defaults include these runtime controls:

- `runAsNonRoot: true` with fixed non-root UID/GID values.
- `readOnlyRootFilesystem: true` with `/tmp` backed by `emptyDir`.
- `allowPrivilegeEscalation: false`.
- Linux capabilities dropped with `drop: [ALL]`.
- `seccompProfile.type: RuntimeDefault`.
- CPU and memory requests and limits for web, API, gateway, and worker.
- Separate ServiceAccounts for each component when `serviceAccount.create` is true.
- `automountServiceAccountToken: false` on ServiceAccounts and pods by default.
- NetworkPolicy generation controlled by `networkPolicy.enabled`.

For production, keep `networkPolicy.enabled=true`; staging and production values set `networkPolicy.allowExternalEgress=false` unless specific egress is approved. Scope ServiceAccount RBAC outside this chart to the minimum required verbs/resources, and prefer immutable image digests over mutable tags.

When `helm` is installed, `pnpm security:k8s` renders the default, dev, staging, and production chart values into a temporary directory before invoking installed Kubernetes scanners. If `helm` is absent, the script skips rendering and still runs the lightweight hardening checklist against deployment assets.

## Image Digest Pinning

The chart renders `image.registry/image.repositoryPrefix/component:image.tag` by default. Set component-level digests such as `api.image.digest`, `web.image.digest`, `gateway.image.digest`, and `worker.image.digest` to render references such as `registry.example.com/mcp-hub/api@sha256:...`. Use digest pinning in shared and production environments after each component image is built, scanned, and signed.

## Auth Trust Boundary

The current API skeleton does not verify JWTs directly at runtime. In `oidc` mode it accepts OIDC-compatible identity headers such as `x-user-id`, `x-team-ids`, `x-groups`, `x-roles`, `x-principal-type`, and `x-client-id`. Shared and production deployments must place the API behind a trusted auth proxy or ingress that verifies identity, strips any client-supplied identity headers, and injects trusted values before requests reach the API.

## Kill-Switch Operation Endpoints

Platform admins can use existing Control Plane API routes to disable access without adding new endpoints:

- `POST /api/servers/:serverId/disable` disables one server.
- `POST /api/servers/:serverId/tools/:toolId/disable` disables one tool by tool id.
- `POST /api/admin/revoke-server-grants/:serverId` revokes enabled grants for one server.
- `POST /api/admin/emergency-deny` enables emergency deny policy with a required `reason` and optional scoping fields.
- `POST /api/admin/emergency-deny/disable` disables emergency deny policy.

Emergency deny can be scoped with `global`, `highCritical`, `serverIds`, `serverSlugs`, `toolNames`, `subjectIds`, and `clientIds`. All kill-switch routes require platform admin authorization and emit audit events.

Examples for local operator testing:

```sh
curl -X POST http://localhost:4000/api/admin/emergency-deny \
  -H 'content-type: application/json' \
  -d '{"reason":"operator test","serverSlugs":["echo"]}'

curl -X POST http://localhost:4000/api/admin/emergency-deny/disable

curl -X POST http://localhost:4000/api/admin/revoke-server-grants/00000000-0000-4000-8000-000000000100
```

Use `/admin` for the same operations through the Web UI. Emergency state and grant revocation results are in memory in the current API skeleton, so restart behavior is not durable yet.

See [RUNBOOK.md](RUNBOOK.md) for incident response steps and [MCP_SERVER_ONBOARDING.md](MCP_SERVER_ONBOARDING.md) for manifest review workflow.
