#!/usr/bin/env bash
set -euo pipefail

scripts/gen/openapi.sh --check
scripts/gen/schemas.sh --check
go run ./scripts/security/check-mcp-manifest.go
