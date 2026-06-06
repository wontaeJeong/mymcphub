# 15. 운영 문서 및 Runbook 작성

MCP Hub를 실제 운영할 수 있도록 문서와 runbook을 작성한다.

## 입력 전제

기존 monorepo 구현 결과물을 기준으로 작업한다.

## 작업 목표

`docs/` 아래에 운영자가 바로 참고할 수 있는 문서를 작성한다.

## 필수 문서

```txt
docs/ARCHITECTURE.md
docs/LOCAL_DEV.md
docs/DATA_MODEL.md
docs/API.md
docs/GATEWAY.md
docs/POLICY.md
docs/AUDIT_OBSERVABILITY.md
docs/SECURITY.md
docs/DEPLOYMENT.md
docs/RELEASE.md
docs/RUNBOOK.md
docs/CLIENT_SETUP.md
docs/MCP_SERVER_ONBOARDING.md
```

이미 있는 문서는 갱신하고, 없는 문서는 새로 만든다.

## RUNBOOK 필수 항목

다음 상황별 대응 절차를 작성한다.

1. 특정 MCP server 장애
2. upstream timeout 증가
3. tool call deny 급증
4. audit log 적재 실패
5. DB migration 실패
6. OIDC issuer 장애
7. 특정 user/client 차단
8. 특정 server emergency disable
9. high-risk tool 오등록 발견
10. MCP server schema breaking change
11. Gateway latency 증가
12. Redis 장애
13. Postgres 장애
14. rollback 절차

각 runbook은 다음 형식을 따른다.

```txt
증상
영향 범위
즉시 확인할 것
완화 조치
근본 원인 확인
복구 확인
사후 조치
```

## Client setup 문서

다음 client 유형별 설정 예시를 작성한다.

- generic remote MCP client
- opencode
- Claude Code style config
- Codex style config placeholder
- VS Code style config placeholder

정확한 client 포맷이 불확실한 경우 placeholder로 표시하고, Hub UI의 client config generator와 연결되도록 설명한다.

## MCP server onboarding 문서

다음 절차를 작성한다.

1. manifest 작성
2. owner team 지정
3. transport 선택
4. local test
5. tools/list scan
6. risk review
7. secret binding
8. dev 등록
9. stg promotion
10. prod approval
11. monitoring 확인

## 완료 조건

- 모든 필수 문서 존재
- 문서가 현재 코드 구조와 일치
- runbook이 실제 명령/URL/로그 위치를 포함
- README에서 주요 문서로 링크
