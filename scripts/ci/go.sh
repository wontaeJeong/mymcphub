#!/usr/bin/env sh
set -eu
gofmt_files=$(gofmt -l internal apps/api apps/worker apps/cli dev/mock-mcp 2>/dev/null)
test -z "$gofmt_files" || { printf '%s\n' "$gofmt_files"; exit 1; }
go vet ./apps/api/cmd/api ./apps/worker/cmd/worker ./apps/cli/cmd/mcphubctl ./internal/...
go test ./apps/api/cmd/api ./apps/worker/cmd/worker ./apps/cli/cmd/mcphubctl ./internal/...
go build ./apps/api/cmd/api ./apps/worker/cmd/worker ./apps/cli/cmd/mcphubctl
