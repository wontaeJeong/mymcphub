#!/usr/bin/env sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_root"

local_database_url="postgres://mcp:mcp@localhost:5432/mcp_hub"

docker compose exec -T postgres psql -U mcp -d postgres -v ON_ERROR_STOP=1 <<'SQL'
select pg_terminate_backend(pid)
from pg_stat_activity
where datname = 'mcp_hub' and pid <> pg_backend_pid();
drop database if exists mcp_hub;
create database mcp_hub owner mcp;
SQL

DATABASE_URL="$local_database_url" pnpm --filter @mcp-hub/db migrate
DATABASE_URL="$local_database_url" pnpm --filter @mcp-hub/db seed
