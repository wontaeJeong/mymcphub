#!/usr/bin/env sh
set -eu
pnpm --filter @mcp-hub/ui typecheck
pnpm --filter @mcp-hub/web typecheck
pnpm --filter @mcp-hub/web test
pnpm --filter @mcp-hub/web build
