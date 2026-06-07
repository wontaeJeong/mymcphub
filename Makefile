SHELL := /bin/sh

.PHONY: dev build lint test ci fmt schema gen-openapi gen-schemas

dev:
	./scripts/dev/run-go-core.sh

build:
	go build ./apps/api/cmd/api ./apps/gateway/cmd/gateway ./apps/worker/cmd/worker ./apps/cli/cmd/mcphubctl ./servers/k8s/cmd/k8s
	pnpm -r --if-present build

lint:
	@test -z "$$(gofmt -l internal apps/api apps/gateway apps/worker apps/cli servers/k8s tests 2>/dev/null)" || (gofmt -l internal apps/api apps/gateway apps/worker apps/cli servers/k8s tests && exit 1)
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

fmt:
	gofmt -w internal apps/api apps/gateway apps/worker apps/cli servers/k8s tests
	pnpm format

gen-openapi:
	./scripts/gen/openapi.sh

gen-schemas:
	./scripts/gen/schemas.sh

schema: gen-openapi gen-schemas
