# 01. MCP Hub 모노레포 초기 생성

현재 작업 디렉토리 아래에 웹 UI를 포함한 MCP Hub 모노레포 골격을 생성한다.

## 입력 전제

`00_CONTEXT.md`의 내용을 공통 전제로 사용한다.

## 작업 목표

다음 구조를 생성한다.

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
│   ├── auth
│   ├── config
│   ├── db
│   ├── logger
│   ├── mcp-protocol
│   ├── policy
│   └── ui
├── schemas
│   ├── openapi
│   ├── catalog
│   └── policy
├── deploy
│   ├── helm
│   └── gitops
├── docs
├── scripts
├── tests
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── eslint.config.js
├── prettier.config.js
├── .env.example
└── README.md
```

## 구현 요구사항

1. `pnpm workspace`와 `turbo`를 설정한다.
2. 모든 app/package는 TypeScript 기반으로 둔다.
3. 공통 script를 root `package.json`에 정의한다.

```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "typecheck": "turbo typecheck",
    "format": "prettier --write ."
  }
}
```

4. 각 app/package에 최소 `package.json`, `tsconfig.json`, `src/index.ts` 또는 해당 framework entrypoint를 만든다.
5. `apps/web`은 Next.js App Router 기반으로 초기화한다.
6. `apps/api`, `apps/gateway`, `apps/worker`는 TypeScript service로 초기화한다.
7. `servers/echo`, `servers/k8s-readonly`, `servers/internal-docs`는 MCP server 예시가 들어갈 수 있는 패키지 구조로 만든다.
8. root README에는 전체 구조, 실행 방법, 개발 순서를 적는다.
9. `.env.example`에는 다음 키를 포함한다.

```env
NODE_ENV=development
DATABASE_URL=postgres://mcp:mcp@localhost:5432/mcp_hub
REDIS_URL=redis://localhost:6379
OIDC_ISSUER_URL=http://localhost:8080/realms/mcp-hub
OIDC_AUDIENCE=mcp-hub
OIDC_CLIENT_ID=mcp-hub-web
OIDC_CLIENT_SECRET=dev-secret
MCP_HUB_PUBLIC_URL=http://localhost:3000
MCP_API_URL=http://localhost:4000
MCP_GATEWAY_URL=http://localhost:5000
LOG_LEVEL=debug
```

10. `docs/ARCHITECTURE.md`에 Control Plane/Data Plane/Runtime Plane 구분을 문서화한다.

## 품질 기준

- 불필요한 복잡한 framework를 과하게 넣지 않는다.
- 초기 실행 가능한 skeleton을 우선 만든다.
- 각 package boundary가 명확해야 한다.
- 추후 API/Gateway/UI 기능을 붙일 수 있도록 dependency 방향을 정리한다.

## 완료 조건

- `pnpm install` 성공
- `pnpm typecheck` 성공
- `pnpm lint` 성공
- `pnpm test`가 최소 placeholder test로 성공
- `README.md`에 로컬 실행 순서가 있음
- 생성한 파일 목록과 주요 의사결정을 마지막에 요약
