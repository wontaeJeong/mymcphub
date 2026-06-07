#!/usr/bin/env bash
set -euo pipefail

version=""
revision="${GITHUB_SHA:-unknown}"
schema_changes="none"
cli_artifacts="not provided"
output="-"
image_digests=()

usage() {
  cat <<'USAGE'
Usage: bash scripts/release/generate-notes.sh --version <version> [options]

Options:
  --revision <git-sha>                 Source revision for the release record.
  --image-digest <component=sha256:..> Component image digest. Repeatable.
  --cli-artifacts <text>               CLI binary artifact summary or URL list.
  --schema-changes <text>              OpenAPI/JSON Schema/DB migration summary.
  --output <file|- >                   Output path. Defaults to stdout.

The script only renders Markdown release notes. It does not push tags, publish
artifacts, mutate GitOps overlays, or contact a registry.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --)
      shift
      ;;
    --version)
      version="${2:-}"
      shift 2
      ;;
    --revision)
      revision="${2:-}"
      shift 2
      ;;
    --image-digest)
      image_digests+=("${2:-}")
      shift 2
      ;;
    --cli-artifacts)
      cli_artifacts="${2:-}"
      shift 2
      ;;
    --schema-changes)
      schema_changes="${2:-}"
      shift 2
      ;;
    --output)
      output="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ -z "$version" ]; then
  printf 'Missing required --version.\n' >&2
  usage >&2
  exit 2
fi

for digest in "${image_digests[@]}"; do
  case "$digest" in
    *=sha256:*) ;;
    *)
      printf 'Invalid --image-digest %s; expected component=sha256:...\n' "$digest" >&2
      exit 2
      ;;
  esac
done

render() {
  printf '# MCP Hub %s\n\n' "$version"
  printf -- '- Generated: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf -- '- Source revision: `%s`\n\n' "$revision"

  printf '## Image Digests\n\n'
  if [ "${#image_digests[@]}" -eq 0 ]; then
    printf -- '- Not provided. Capture registry digests before staging or production promotion.\n\n'
  else
    for digest in "${image_digests[@]}"; do
      component="${digest%%=*}"
      value="${digest#*=}"
      printf -- '- `%s`: `%s`\n' "$component" "$value"
    done
    printf '\n'
  fi

  printf '## CLI Artifacts\n\n'
  printf '%s\n\n' "$cli_artifacts"

  printf '## Schema Changes\n\n'
  printf '%s\n\n' "$schema_changes"

  printf '## Required Validation\n\n'
  printf -- '- `go test ./...`\n'
  printf -- '- `pnpm --filter @mcp-hub/web test`\n'
  printf -- '- `scripts/ci/schemas.sh`\n'
  printf -- '- `bash tests/helm-template.sh`\n'
  printf -- '- Gateway MCP smoke: initialize, `tools/list`, approved `tools/call`, auth deny, policy deny.\n'
}

if [ "$output" = "-" ]; then
  render
else
  mkdir -p "$(dirname "$output")"
  render >"$output"
fi
