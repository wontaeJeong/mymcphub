#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

trap 'kill 0' INT TERM EXIT
PORT=4000 go run ./apps/api/cmd/api &
PORT=5000 go run ./apps/gateway/cmd/gateway &
PORT=4100 go run ./apps/worker/cmd/worker &
PORT=5102 go run ./servers/k8s/cmd/k8s &
pnpm --filter @mcp-hub/web dev
