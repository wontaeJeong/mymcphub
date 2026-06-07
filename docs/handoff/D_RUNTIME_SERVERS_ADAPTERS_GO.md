# Lane D - Go Runtime/Servers/Adapters Handoff

## 변경 파일

- `internal/runtime/runtime.go`, `internal/runtime/runtime_test.go`
- `internal/mcp/simple_server.go`
- `internal/db/types.go`, `internal/db/store.go`
- `internal/jobs/jobs.go`, `internal/jobs/jobs_test.go`
- `internal/controlplane/server.go`, `internal/controlplane/server_test.go`
- `servers/k8s`, `servers/runtime-adapter`, `servers/github`, `servers/gitlab`, `servers/internal-docs`
- `schemas/jsonschema/mcp-server.schema.json`, `schemas/catalog/mcp-server-manifest.schema.json`, `schemas/openapi/mcp-hub.openapi.yaml`
- `deploy/helm/mcp-hub/templates/runtime-controller-rbac.yaml`, `deploy/helm/mcp-hub/templates/configmap.yaml`, `deploy/helm/mcp-hub/templates/deployment-worker.yaml`, `deploy/helm/mcp-hub/values.yaml`
- `scripts/security/check-mcp-manifest.go`, `scripts/ci/go.sh`, `.github/workflows/ci.yaml`, `Makefile`, `docs/CONTRACTS.md`, `docs/WORKER.md`, `docs/MCP_SERVER_ONBOARDING.md`, `docs/MCP_SERVER_LANGUAGE_MATRIX.md`
- New server Dockerfiles under `servers/runtime-adapter`, `servers/github`, `servers/gitlab`, and `servers/internal-docs`.

## Contract/Schema 변경

- MCP server manifest에 `runtime`, `secrets`, `egress`, `sandbox`, `policyTags`, `version`, tool `readOnly`/`policyTags`를 추가했다.
- Catalog/runtime validation은 schema와 맞춰 `slug`, `environment`, `transport`, `riskLevel`, `implementationLanguage`, runtime port/pull policy/replica, egress protocol/port, sandbox profile/seccomp, tool `riskLevel`/closed input schema를 검사한다.
- Secret binding은 외부 secret reference만 허용하며 `value`, `token`, `credential`, `password`, `clientSecret` raw secret 필드는 runtime parser와 manifest security checker에서 거부한다.
- Control Plane OpenAPI에 runtime status/secret lease 조회 및 lease revoke 경로를 추가했다.
- `GET /api/runtime/status`, `GET /api/servers/{serverId}/runtime`, `GET /api/runtime/secret-leases`, lease revoke는 rendered secret reference metadata 노출을 막기 위해 platform admin 전용이다.
- `MCP_AUTH_MODE=oidc`에서 API는 `MCP_TRUSTED_AUTH_HEADER_TOKEN`과 일치하는 `x-auth-proxy-token`이 있을 때만 ingress identity headers를 신뢰한다.
- Worker `/jobs/run` 수동 트리거는 `MCP_WORKER_JOB_TOKEN` 또는 local mock platform-admin bearer token이 필요하다. 예약 RunLoop는 HTTP trigger token 없이 동작한다.
- Worker `/jobs/run`은 malformed JSON, trailing JSON, JSON `null`을 기본 job 실행으로 처리하지 않고 400을 반환한다.
- Server version list는 `manifestJson` metadata를 포함할 수 있어 platform admin 전용이며, version `manifestJson`은 runtime manifest contract로 검증한 뒤 저장한다. Mutation audit arguments는 중앙 redaction을 통과한다.
- Helm/GitOps OIDC 렌더링은 trusted auth proxy token secret ref와 Worker job token secret ref를 요구한다. 기본 chart는 OIDC이고 dev values만 mock이다.
- Worker `/jobs/run`은 body가 명시적 JSON 배열일 때만 실행한다.
- Static YAML/JSON OpenAPI 모두 version create/activate/rollback/list와 runtime endpoints의 admin-required/403 contract를 기록한다.
- Render-only runtime-controller RBAC는 Secret 값을 읽지 않는다. Secret injection은 rendered `secretKeyRef` metadata만 사용한다.

## DB Migration 여부

- 없음. 현재 저장소는 in-memory/file-backed `db.Store` 확장이며 SQL migration은 추가하지 않았다.

## 테스트 결과

- `go test ./...`: pass
- `make build`: pass
- `make lint`: pass
- `scripts/ci/schemas.sh`: pass, manifest review warning 4건은 위험 키워드 리뷰 알림
- `pnpm helm:template`: pass
- `pnpm --filter @mcp-hub/web test`: pass
- `docker build -f apps/worker/Dockerfile -t mcp-hub/worker:lane-d-qa .`: pass
- Worker container QA: unauthenticated `/jobs/run` 403, `authorization: Bearer dev-admin-token`으로 기본 job set의 `runtime-reconcile` success, Worker image 내부 manifest 경로 확인 완료
- API runtime QA: OIDC에서 spoofed admin headers without trusted proxy token 403, trusted reader 403, trusted platform admin의 `/api/runtime/status`와 lease list 200
- API version QA: trusted reader version list 403, trusted platform admin version list 200, raw secret field가 포함된 version `manifestJson` create 400
- Worker HTTP QA: authenticated malformed `/jobs/run` JSON 400, authenticated `null` body 400, unauthenticated `/jobs/run` 403
- Worker trailing JSON QA: authenticated `/jobs/run` body `[] {}` 400
- Raw secret negative QA: manifest `secrets[].token` 및 unknown `secrets[].apiKey` 포함 시 security checker가 error로 실패
- Schema parity QA: `schemas/jsonschema/mcp-server.schema.json`와 `schemas/catalog/mcp-server-manifest.schema.json` byte-identical 확인
- JSON OpenAPI QA: `schemas/openapi/control-plane.openapi.json`에 runtime/version admin paths 존재 확인
- Version OpenAPI QA: YAML/JSON OpenAPI의 version create/activate/rollback admin-required marker 확인
- Helm QA: prod render에 `MCP_TRUSTED_AUTH_HEADER_TOKEN`과 `MCP_WORKER_JOB_TOKEN` secret refs 존재 확인, OIDC render에서 token secretName/secretKey 누락 시 fail 확인
- RBAC QA: prod Helm render에 `resources: ["secrets"]` 권한 없음 확인

## 남은 TODO

- 실제 Kubernetes apply/watch 모드는 아직 없다. 현재 controller는 render-only 상태를 저장한다.
- FQDN egress는 vanilla NetworkPolicy로 강제할 수 없어 annotation으로 남긴다.
- Next.js build는 통과하지만 기존 ESLint config에 Next.js plugin 미감지 warning이 출력된다.

## 충돌 가능성

- Lane B/C가 OpenAPI 및 manifest payload를 사용하면 runtime paths/schema additions를 반영해야 한다.
- Lane F security checks와 manifest warning 기준이 겹칠 수 있다.
