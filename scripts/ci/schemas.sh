#!/usr/bin/env bash
set -euo pipefail

scripts/gen/openapi.sh --check
scripts/gen/schemas.sh --check
go run ./tools/cmd/check-mcp-manifest
