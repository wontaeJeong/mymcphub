#!/usr/bin/env sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_root"

profile_args=""
services="postgres redis keycloak"

for arg in "$@"; do
  case "$arg" in
    --)
      ;;
    --otel)
      profile_args="--profile otel"
      services="$services otel-collector"
      ;;
    *)
      printf 'Unknown option: %s\n' "$arg" >&2
      printf 'Usage: %s [--otel]\n' "$0" >&2
      exit 2
      ;;
  esac
done

# shellcheck disable=SC2086
docker compose $profile_args up -d --wait $services

printf 'Local infra is running. Use pnpm dev:infra:down to stop it.\n'
