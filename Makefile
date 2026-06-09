SHELL := /bin/sh
GO_TARGETS := ./apps/api/cmd/api ./apps/worker/cmd/worker ./apps/cli/cmd/mcphubctl
GO_DIRS := internal apps/api apps/worker apps/cli dev/mock-mcp
.PHONY: dev infra-up infra-down migrate build lint test ci helm-template

dev:
	@trap 'kill 0' INT TERM EXIT; \
	MCPHUB_AUTH_MODE=$${MCPHUB_AUTH_MODE:-dev} PORT=4000 go run ./apps/api/cmd/api & \
	MCPHUB_AUTH_MODE=$${MCPHUB_AUTH_MODE:-dev} PORT=4100 go run ./apps/worker/cmd/worker & \
	pnpm --filter @mcp-hub/web dev

infra-up:
	docker compose up -d --wait postgres

infra-down:
	docker compose down

migrate:
	@test -n "$$(command -v psql)" || (echo "psql is required to apply migrations." >&2; exit 1)
	@for file in migrations/*.sql; do psql "$${DATABASE_URL:-postgres://mcp:mcp@localhost:5432/mcp_hub?sslmode=disable}" -v ON_ERROR_STOP=1 -f "$$file"; done

build:
	go build $(GO_TARGETS)
	pnpm -r --if-present build

lint:
	@test -z "$$(gofmt -l $(GO_DIRS) 2>/dev/null)" || (gofmt -l $(GO_DIRS) && exit 1)
	go vet $(GO_TARGETS) ./internal/...
	pnpm -r --if-present lint

test:
	go test $(GO_TARGETS) ./internal/...
	pnpm -r --if-present test

ci: lint test build helm-template

helm-template:
	helm template mcp-hub deploy/helm/mcp-hub >/dev/null
