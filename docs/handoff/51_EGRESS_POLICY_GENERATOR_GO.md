# 51 Egress Policy Generator Go Handoff

- 변경 파일: `internal/runtime/runtime.go`, manifest schemas, first-party manifests.
- Contract/schema 변경: manifest `egress.denyByDefault` and `egress.allow[]` added.
- DB migration 여부: 없음.
- 테스트 결과: runtime renderer test validates CIDR egress and FQDN annotation output.
- 남은 TODO: FQDN host allowlists require CNI-specific enforcement beyond vanilla NetworkPolicy.
- 충돌 가능성: Helm chart-level NetworkPolicy remains separate from per-server runtime-rendered policies.
