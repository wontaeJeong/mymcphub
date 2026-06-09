# Scripts

Local automation scripts for development, CI, generation, and release support live here. Operator actions move to `mcphubctl`, the Web UI, or the Control Plane API.

Security scan and hardening checks are in [security/](security/). Run all security checks from the repository root with:

```sh
pnpm security:check
```

## Allowed Script Scope

- `scripts/dev`: local-only executable helpers such as infra startup and seed helpers; dev config data lives under `../config/dev`.
- `scripts/ci`: CI wrappers for Go, Web UI, schemas, and Helm.
- `scripts/gen`: OpenAPI and JSON Schema generation/drift checks.
- `scripts/release`: release helper scripts only.
- `scripts/deprecated`: reserved for future warning wrappers if retired operational scripts need them.

Scripts must not be the primary interface for server publish/disable, grant approve/revoke, policy apply, direct DB mutation, direct Kubernetes patching, or secret manipulation.

## Local Development Scripts

Local development helpers are in [dev/](dev/):

```sh
pnpm dev:infra
pnpm db:migrate
pnpm db:seed
pnpm dev:smoke-test
pnpm dev:infra:down
```

See [../docs/LOCAL_DEV.md](../docs/LOCAL_DEV.md) for the full local workflow, reset command, mock token helper, and smoke-test coverage.

## Release Scripts

Release-note generation is intentionally render-only:

```sh
pnpm release:notes -- --version 0.1.0 --image-digest api=sha256:...
```

`scripts/release/generate-notes.sh` writes Markdown with the release version, source revision, image digests, CLI artifacts, schema-change summary, and required validation checklist. It does not push tags, publish artifacts, mutate GitOps overlays, or contact a registry.
