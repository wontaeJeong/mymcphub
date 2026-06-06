# Scripts

Local automation scripts for development, release, and operations tasks live here.

Security scan and hardening checks are in [security/](security/). Run all prompt-11 checks from the repository root with:

```sh
pnpm security:check
```

## Local Development Scripts

Prompt-13 local development helpers are in [dev/](dev/):

```sh
pnpm dev:infra
pnpm db:migrate
pnpm db:seed
pnpm dev:stdio-adapter
pnpm dev:smoke-test
pnpm dev:infra:down
```

See [../docs/LOCAL_DEV.md](../docs/LOCAL_DEV.md) for the full local workflow, reset command, mock token helper, and smoke-test coverage.
