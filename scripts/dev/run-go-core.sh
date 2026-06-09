#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
trap 'kill 0' INT TERM EXIT
MCPHUB_AUTH_MODE=${MCPHUB_AUTH_MODE:-dev} PORT=4000 go run ./apps/api/cmd/api &
MCPHUB_AUTH_MODE=${MCPHUB_AUTH_MODE:-dev} PORT=4100 go run ./apps/worker/cmd/worker &
pnpm --filter @mcp-hub/web dev
