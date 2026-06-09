SHELL := /bin/sh

.PHONY: dev build lint test ci fmt schema security gen-openapi gen-schemas demo-check release-notes

dev:
	./scripts/dev/run-go-core.sh

build:
	go build ./apps/api/cmd/api ./apps/gateway/cmd/gateway ./apps/worker/cmd/worker ./apps/cli/cmd/mcphubctl ./servers/k8s/cmd/k8s ./servers/runtime-adapter/cmd/runtime-adapter ./servers/github/cmd/github ./servers/gitlab/cmd/gitlab ./servers/internal-docs/cmd/internal-docs
	pnpm -r --if-present build

lint:
	@test -z "$$(gofmt -l internal apps/api apps/gateway apps/worker apps/cli servers tests tools 2>/dev/null)" || (gofmt -l internal apps/api apps/gateway apps/worker apps/cli servers tests tools && exit 1)
	go vet ./...
	pnpm -r --if-present lint

test:
	go test ./...
	pnpm -r --if-present test

ci:
	./scripts/ci/go.sh
	./scripts/ci/web.sh
	./scripts/ci/schemas.sh
	./scripts/ci/helm.sh
	./scripts/security/check-all.sh

fmt:
	gofmt -w internal apps/api apps/gateway apps/worker apps/cli servers tests tools
	pnpm format

gen-openapi:
	./scripts/gen/openapi.sh

gen-schemas:
	./scripts/gen/schemas.sh

schema: gen-openapi gen-schemas

demo-check:
	go test ./internal/... ./tests/e2e ./tests/security
	pnpm --filter @mcp-hub/web test:unit
	pnpm typecheck
	pnpm helm:template

security:
	./scripts/security/check-all.sh

release-notes:
	bash scripts/release/generate-notes.sh --version "$${VERSION:?VERSION is required}"
