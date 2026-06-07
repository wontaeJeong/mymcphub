#!/usr/bin/env bash
set -euo pipefail

SOURCE="schemas/openapi/mcp-hub.openapi.yaml"
TARGET="apps/web/lib/generated/mcp-hub-client.ts"

if [ "${1:-}" = "--check" ]; then
  test -s "$SOURCE"
  test -s "$TARGET"
  grep -q "generatedApiRequest" "$TARGET"
  grep -q "GeneratedApiClientError" "$TARGET"
  grep -q "getGeneratedApiBaseUrl" "$TARGET"
  while IFS= read -r path; do
    grep -Fq "\"${path}\"" internal/controlplane/server.go || {
      echo "OpenAPI path ${path} is missing from runtime /openapi.json document" >&2
      exit 1
    }
  done < <(awk '/^  \/.*:$/ { sub(":$", "", $1); print $1 }' "$SOURCE")
  exit 0
fi

test -s "$SOURCE"
test -s "$TARGET"
echo "OpenAPI source and generated TypeScript client are present."
