#!/usr/bin/env sh
set -eu

echo "Go core local state is process-local. Restart the API/Gateway/Worker to reset seeded data."
echo "PostgreSQL reset is not used by the current in-memory skeleton."
