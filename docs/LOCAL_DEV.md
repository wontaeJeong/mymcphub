# Local development

```sh
pnpm install
docker compose up -d postgres
cp .env.example .env
make migrate
make dev
```

`make dev` starts API on `:4000`, Worker on `:4100`, and Next.js Web on `:3000`. PostgreSQL is the only required local dependency. Redis, Keycloak, OTel, Gateway, and first-party MCP servers are not part of the MVP local stack.
