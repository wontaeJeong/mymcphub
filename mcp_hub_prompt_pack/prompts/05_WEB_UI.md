# 05. Web UI 구현

MCP Hub의 관리 UI를 `apps/web`에 구현한다.

## 입력 전제

`00_CONTEXT.md`, `03_CONTROL_PLANE_API.md` 결과물을 기준으로 작업한다.

## 작업 목표

Next.js App Router 기반으로 MCP Hub 운영 UI를 만든다.

## 필수 화면

1. Dashboard
2. MCP Server Catalog
3. Server Detail
4. Tool Explorer
5. Access Request / Grants
6. Approval Queue
7. Audit Log
8. Health / Operations
9. Client Config Generator
10. Admin Emergency Controls

## 화면별 요구사항

### Dashboard

- 등록된 서버 수
- enabled/disabled 서버 수
- high/critical risk tool 수
- 최근 denied call 수
- 최근 failed upstream 수
- active session 수

### MCP Server Catalog

- server 목록 표시
- slug, display name, owner team, environment, transport, risk level, health, enabled 상태
- 검색/필터
- server 등록 버튼

### Server Detail

- 기본 정보
- upstream URL
- transport
- health 상태
- tools 목록
- schema version
- 최근 audit event
- enable/disable 버튼

### Tool Explorer

- tool name
- description
- input schema viewer
- risk level
- enabled/disabled
- 사용 권한 여부
- 관리자용 test call placeholder

### Access Request / Grants

- 사용자가 특정 server/tool 접근 요청 가능
- project, reason, ticket URL, expiry 입력
- 기존 grant 목록 확인
- revoke 요청 또는 admin revoke

### Approval Queue

- pending request 목록
- approve/reject
- 승인 시 allowed tools, expiry, reason 입력

### Audit Log

- user/team/project/server/tool/method/status/risk 기준 필터
- argument는 redacted view만 표시
- trace id 복사 가능

### Client Config Generator

- server 선택
- client 종류 선택
- generated config 표시
- copy 버튼
- Gateway URL 표시

### Admin Emergency Controls

- server disable
- tool disable
- all grants revoke
- emergency deny policy enable/disable
- 위험한 동작은 confirmation 필요

## UI 구현 원칙

- 처음부터 완성도 높은 디자인보다 운영 정보 구조를 우선한다.
- API client layer를 분리한다.
- loading/error/empty state를 만든다.
- 권한 없는 메뉴는 숨기거나 disabled 처리한다.
- mock data가 아니라 Control Plane API를 호출한다.

## 완료 조건

- `pnpm dev --filter web` 또는 monorepo dev로 실행 가능
- seed data 기준 server catalog 표시
- server detail 표시
- approval approve/reject 가능
- audit log 조회 가능
- client config 생성 가능
- 기본 반응형 레이아웃
- Playwright 또는 component test 최소 1개 이상
- `apps/web/README.md` 작성
