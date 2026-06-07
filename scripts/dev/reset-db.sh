#!/usr/bin/env sh
set -eu

store_path="${MCP_STORE_PATH:-/tmp/mcp-hub/store.json}"
rm -f "$store_path"
echo "Removed Go core local state at $store_path if it existed."
echo "Restart the API/Gateway/Worker to recreate seeded data from internal/db.NewSeedStore."
echo "PostgreSQL reset is not used by the current in-memory skeleton."
