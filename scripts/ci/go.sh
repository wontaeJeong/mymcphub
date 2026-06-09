#!/usr/bin/env bash
set -euo pipefail

test -z "$(gofmt -l internal apps/api apps/gateway apps/worker apps/cli servers tests tools 2>/dev/null)" || {
  gofmt -l internal apps/api apps/gateway apps/worker apps/cli servers tests tools
  exit 1
}
go vet ./...
go test ./...
go build ./apps/api/cmd/api ./apps/gateway/cmd/gateway ./apps/worker/cmd/worker ./apps/cli/cmd/mcphubctl ./servers/k8s/cmd/k8s ./servers/runtime-adapter/cmd/runtime-adapter ./servers/github/cmd/github ./servers/gitlab/cmd/gitlab ./servers/internal-docs/cmd/internal-docs
