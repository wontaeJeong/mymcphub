# MCP Hub 작업 프롬프트 팩

이 ZIP은 웹 UI를 포함한 사내 MCP Hub를 모노레포로 구현하기 위한 작업 프롬프트 모음입니다.

## 사용 순서

권장 순서는 다음과 같습니다.

1. `00_CONTEXT.md`를 먼저 작업 에이전트에 제공합니다.
2. 초기 구현은 `01_CREATE_MONOREPO.md`부터 진행합니다.
3. 이후 `02` ~ `15`를 순서대로 적용합니다.
4. 한 번에 큰 골격을 만들고 싶으면 `MASTER_PROMPT_ALL_IN_ONE.md`를 사용합니다.

## 기본 전제

- 모노레포 기반
- TypeScript 중심
- `pnpm workspace` + `turbo`
- Web UI 포함
- Control Plane API와 MCP Gateway 분리
- MCP 서버 카탈로그, 권한, 감사로그, 승인 플로우 포함
- Kubernetes/Helm/GitOps 운영 고려
- 사내 OIDC/SSO 연동 가능 구조
- 처음부터 보안/감사/운영 요구사항을 코드 구조에 반영

## 산출물 목표

최종 목표는 다음 구조의 레포지토리입니다.

```txt
mcp-hub
├── apps
│   ├── web
│   ├── api
│   ├── gateway
│   └── worker
├── servers
│   ├── echo
│   ├── k8s-readonly
│   └── internal-docs
├── packages
│   ├── config
│   ├── db
│   ├── logger
│   ├── mcp-protocol
│   ├── policy
│   ├── auth
│   └── ui
├── deploy
│   ├── helm
│   └── gitops
├── schemas
├── docs
├── scripts
└── tests
```

## 프롬프트 목록

- `00_CONTEXT.md`: 공통 배경/제약/아키텍처 전제
- `01_CREATE_MONOREPO.md`: 모노레포 초기 생성
- `02_SHARED_SCHEMA_DB_MODEL.md`: DB schema, shared types, migrations
- `03_CONTROL_PLANE_API.md`: Control Plane API 구현
- `04_MCP_GATEWAY.md`: MCP Gateway 구현
- `05_WEB_UI.md`: Web UI 구현
- `06_FIRST_PARTY_MCP_SERVERS.md`: 1st-party MCP 서버 예시 구현
- `07_STDIO_ADAPTER_RUNTIME.md`: stdio adapter/runtime 구조 구현
- `08_AUTH_POLICY_APPROVAL.md`: 인증, 권한, 승인 플로우
- `09_AUDIT_OBSERVABILITY.md`: 감사로그, metrics, tracing
- `10_HELM_GITOPS.md`: Helm/GitOps 배포 구성
- `11_SECURITY_SCAN_HARDENING.md`: 보안 스캔/런타임 하드닝
- `12_TESTS_CI.md`: 테스트/CI 구성
- `13_LOCAL_DEV_ENV.md`: 로컬 개발 환경
- `14_RELEASE_ROLLOUT.md`: 버전/릴리즈/롤백
- `15_DOCS_OPERATIONS.md`: 운영 문서화
- `MASTER_PROMPT_ALL_IN_ONE.md`: 전체 작업 통합 프롬프트
