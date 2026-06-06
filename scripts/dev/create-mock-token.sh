#!/usr/bin/env sh
set -eu

if [ "${1:-}" = "--" ]; then
  shift
fi

role="${1:-admin}"

case "$role" in
  admin)
    printf 'dev-admin-token\n'
    ;;
  readonly)
    printf 'dev-readonly-token\n'
    ;;
  *)
    printf 'Unknown role: %s\n' "$role" >&2
    printf 'Usage: %s [admin|readonly]\n' "$0" >&2
    exit 2
    ;;
esac
