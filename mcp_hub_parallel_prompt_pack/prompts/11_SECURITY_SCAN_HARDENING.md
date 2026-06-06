# 11. Security Scan 및 Runtime Hardening 구현

MCP Hub와 MCP server 등록/배포 과정에 보안 검증과 런타임 하드닝을 추가한다.

## 입력 전제

`00_CONTEXT.md`, `06_FIRST_PARTY_MCP_SERVERS.md`, `10_HELM_GITOPS.md` 결과물을 기준으로 작업한다.

## 작업 목표

MCP server가 agent에게 외부 시스템 조작 권한을 제공한다는 전제로, 공급망/런타임/도메인 보안 요구사항을 코드와 문서에 반영한다.

## Security scan 대상

1. container image vulnerability
2. filesystem vulnerability
3. dependency vulnerability
4. secret detection
5. MCP tool manifest risk review
6. dangerous tool schema review
7. Dockerfile hardening check
8. Kubernetes manifest hardening check

## 스크립트 요구사항

`scripts/security` 아래에 다음 스크립트를 만든다.

```txt
scan-deps.sh
scan-images.sh
scan-secrets.sh
scan-k8s-manifests.sh
check-mcp-manifest.ts
```

실제 도구가 설치되어 있지 않아도 graceful error message를 출력한다.

도구 후보:

- trivy
- grype
- syft
- gitleaks
- cosign
- kube-score 또는 kube-linter

## MCP manifest check

`mcp-server.manifest.json`에 대해 다음을 검증한다.

- slug 존재
- ownerTeam 존재
- riskLevel 존재
- tool별 riskLevel 존재
- high/critical tool은 readOnly false 여부와 설명 확인
- dangerous keyword 감지

Dangerous keyword 예시:

```txt
delete
exec
shell
apply
write
push
merge
deploy
secret
credential
token
admin
cluster
```

이 키워드가 있으면 실패가 아니라 warning으로 표시하고 review 필요 상태로 만든다.

## Runtime hardening checklist

Helm chart와 docs에 다음 항목을 반영한다.

- runAsNonRoot
- readOnlyRootFilesystem
- allowPrivilegeEscalation false
- drop capabilities
- seccompProfile RuntimeDefault
- resource limits
- network policy
- service account 최소 권한
- egress 제한
- image digest pinning 권장

## Kill switch 요구사항

운영자가 다음을 할 수 있게 API/UI/문서 중 최소 API와 문서에 반영한다.

- server disable
- tool disable
- all grants revoke for server
- emergency deny policy enable

## 완료 조건

- security scripts 추가
- MCP manifest check 구현
- CI에서 security check를 호출할 수 있는 script 추가
- Helm chart hardening 반영
- docs/SECURITY.md 작성
