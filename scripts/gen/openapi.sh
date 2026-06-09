#!/usr/bin/env bash
set -euo pipefail

SOURCE="schemas/openapi/mcp-hub.openapi.yaml"
JSON_TARGET="schemas/openapi/control-plane.openapi.json"
TARGET="apps/web/lib/generated/mcp-hub-client.ts"

if [ "${1:-}" = "--check" ]; then
  test -s "$SOURCE"
  test -s "$JSON_TARGET"
  test -s "$TARGET"
  grep -q "generatedApiRequest" "$TARGET"
  grep -q "GeneratedApiClientError" "$TARGET"
  grep -q "getGeneratedApiBaseUrl" "$TARGET"
  json_tmp="$(mktemp)"
  ts_tmp="$(mktemp)"
  trap 'rm -f "$json_tmp" "$ts_tmp"' EXIT
  go run ./tools/cmd/openapi-json json > "$json_tmp"
  cmp -s "$json_tmp" "$JSON_TARGET" || {
    echo "OpenAPI JSON artifact is out of date. Run scripts/gen/openapi.sh." >&2
    exit 1
  }
  go run ./tools/cmd/openapi-json ts > "$ts_tmp"
  cmp -s "$ts_tmp" "$TARGET" || {
    echo "Generated TypeScript API client is out of date. Run scripts/gen/openapi.sh." >&2
    exit 1
  }
  while IFS= read -r path; do
    grep -Fq "\"${path}\"" internal/controlplane/server.go || {
      echo "OpenAPI path ${path} is missing from runtime /openapi.json document" >&2
      exit 1
    }
    grep -Fq "${path}" "$TARGET" || {
      echo "OpenAPI path ${path} is missing from generated TypeScript client path list" >&2
      exit 1
    }
  done < <(awk '/^  \/.*:$/ { sub(":$", "", $1); print $1 }' "$SOURCE")
  exit 0
fi

test -s "$SOURCE"
go run ./tools/cmd/openapi-json json > "$JSON_TARGET"
go run ./tools/cmd/openapi-json ts > "$TARGET"
test -s "$TARGET"
echo "OpenAPI runtime JSON artifact and TypeScript client were generated."
