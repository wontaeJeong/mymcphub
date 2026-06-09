#!/usr/bin/env bash
set -euo pipefail
if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to apply migrations. Install PostgreSQL client tools or run migrations in CI/container." >&2
  exit 1
fi
DATABASE_URL="${DATABASE_URL:-postgres://mcp:mcp@localhost:5432/mcp_hub?sslmode=disable}"
for file in migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
done
