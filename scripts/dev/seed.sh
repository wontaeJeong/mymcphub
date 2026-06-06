#!/usr/bin/env sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_root"

DATABASE_URL="${DATABASE_URL:-postgres://mcp:mcp@localhost:5432/mcp_hub}" pnpm --filter @mcp-hub/db seed
