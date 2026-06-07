# 50 Secret Broker Runtime Injection Go Handoff

- 변경 파일: `internal/runtime/runtime.go`, `internal/db/types.go`, `internal/db/store.go`, `internal/jobs/jobs.go`, Control Plane runtime lease routes.
- Contract/schema 변경: manifest `secrets[]` is reference-only and rejects raw value/token/password/credential/clientSecret fields.
- DB migration 여부: 없음.
- 테스트 결과: runtime reconcile job persists active lease metadata; API revoke test passes.
- 남은 TODO: external secret broker integration is not added; leases are metadata and Kubernetes `secretKeyRef` render inputs only.
- 충돌 가능성: Lane F compliance/security checks may add stricter secret schema validation.
