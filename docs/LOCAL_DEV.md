# Local development

```sh
pnpm install
make infra-up
cp .env.example .env
make migrate
make dev
```

`make dev` starts API on `:4000`, Worker on `:4100`, and Next.js Web on `:3000`. PostgreSQL is the only required local dependency. Redis, Keycloak, OTel, and separately hosted MCP server processes are not part of the local catalog stack.

Package scripts are thin aliases for the same Makefile targets: `pnpm dev`, `pnpm infra:up`, `pnpm migrate`, `pnpm test`, `pnpm build`, and `pnpm run ci`.
