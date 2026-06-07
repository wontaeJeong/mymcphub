# Scripts

Local automation scripts for development, CI, generation, and release support live here. Operator actions move to `mcphubctl`, the Web UI, or the Control Plane API.

Security scan and hardening checks are in [security/](security/). Run all prompt-11 checks from the repository root with:

```sh
pnpm security:check
```

## Allowed Script Scope

- `scripts/dev`: local-only support such as infra startup and seed helpers.
- `scripts/ci`: CI wrappers for Go, Web UI, schemas, and Helm.
- `scripts/gen`: OpenAPI and JSON Schema generation/drift checks.
- `scripts/release`: release helper scripts only.
- `scripts/deprecated`: warning wrappers for retired operational scripts.

Scripts must not be the primary interface for server publish/disable, grant approve/revoke, policy apply, direct DB mutation, direct Kubernetes patching, or secret manipulation.

## Local Development Scripts

Prompt-13 local development helpers are in [dev/](dev/):

```sh
pnpm dev:infra
pnpm db:migrate
pnpm db:seed
pnpm dev:smoke-test
pnpm dev:infra:down
```

See [../docs/LOCAL_DEV.md](../docs/LOCAL_DEV.md) for the full local workflow, reset command, mock token helper, and smoke-test coverage.
