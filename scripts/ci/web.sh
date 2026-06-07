#!/usr/bin/env bash
set -euo pipefail

pnpm --filter @mcp-hub/ui lint
pnpm --filter @mcp-hub/web lint
pnpm --filter @mcp-hub/ui typecheck
pnpm --filter @mcp-hub/web typecheck
pnpm --filter @mcp-hub/ui test
pnpm --filter @mcp-hub/web test
pnpm --filter @mcp-hub/ui build
pnpm --filter @mcp-hub/web build
