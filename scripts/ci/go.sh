#!/usr/bin/env bash
set -euo pipefail

test -z "$(gofmt -l internal apps/api apps/gateway apps/worker apps/cli servers/k8s tests 2>/dev/null)" || {
  gofmt -l internal apps/api apps/gateway apps/worker apps/cli servers/k8s tests
  exit 1
}
go vet ./...
go test ./...
go build ./apps/api/cmd/api ./apps/gateway/cmd/gateway ./apps/worker/cmd/worker ./apps/cli/cmd/mcphubctl ./servers/k8s/cmd/k8s
