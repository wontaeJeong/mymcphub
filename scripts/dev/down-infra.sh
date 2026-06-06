#!/usr/bin/env sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_root"

volume_args=""

for arg in "$@"; do
  case "$arg" in
    --)
      ;;
    --volumes)
      volume_args="--volumes"
      ;;
    *)
      printf 'Unknown option: %s\n' "$arg" >&2
      printf 'Usage: %s [--volumes]\n' "$0" >&2
      exit 2
      ;;
  esac
done

# shellcheck disable=SC2086
docker compose down $volume_args
