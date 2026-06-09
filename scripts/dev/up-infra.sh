#!/usr/bin/env sh
set -eu
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_root"
docker compose up -d --wait postgres
printf 'PostgreSQL is running. Use pnpm dev:infra:down to stop it.\n'
