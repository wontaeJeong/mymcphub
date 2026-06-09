SHELL := /bin/sh
.PHONY: dev migrate build lint test ci helm-template

dev:
	./scripts/dev/run-go-core.sh

migrate:
	./scripts/dev/db-migrate.sh

build:
	go build ./apps/api/cmd/api ./apps/worker/cmd/worker ./apps/cli/cmd/mcphubctl
	pnpm -r --if-present build

lint:
	@test -z "$$(gofmt -l internal apps/api apps/worker apps/cli dev/mock-mcp 2>/dev/null)" || (gofmt -l internal apps/api apps/worker apps/cli dev/mock-mcp && exit 1)
	go vet ./apps/api/cmd/api ./apps/worker/cmd/worker ./apps/cli/cmd/mcphubctl ./internal/...
	pnpm -r --if-present lint

test:
	go test ./apps/api/cmd/api ./apps/worker/cmd/worker ./apps/cli/cmd/mcphubctl ./internal/...
	pnpm -r --if-present test

ci: lint test build helm-template

helm-template:
	helm template mcp-hub deploy/helm/mcp-hub >/dev/null
