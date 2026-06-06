# 08. Auth, Policy, Approval 구현 고도화

MCP Hub의 인증, 인가, 승인 플로우를 구현/고도화한다.

## 입력 전제

`00_CONTEXT.md`, `02_SHARED_SCHEMA_DB_MODEL.md`, `03_CONTROL_PLANE_API.md`, `04_MCP_GATEWAY.md` 결과물을 기준으로 작업한다.

## 작업 목표

Gateway와 Control Plane API에서 일관된 권한 결정을 내릴 수 있도록 `packages/auth`와 `packages/policy`를 구현한다.

## Auth 요구사항

1. 로컬 mock auth
2. OIDC JWT validation
3. issuer/audience/expiry/subject/client_id 검증
4. team/group claim mapping
5. admin/platform role mapping
6. service account token placeholder 구조

## Policy input

다음 구조의 policy input을 구현한다.

```ts
type PolicyDecisionInput = {
  subject: {
    type: 'user' | 'team' | 'service_account';
    userId?: string;
    teamIds?: string[];
    serviceAccountId?: string;
  };
  client: {
    clientId?: string;
    clientType?: string;
  };
  project?: {
    projectId?: string;
  };
  server: {
    serverId: string;
    serverSlug: string;
    environment: 'dev' | 'stg' | 'prod' | 'shared';
    enabled: boolean;
  };
  tool?: {
    name: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    enabled: boolean;
  };
  action: 'connect' | 'discover_tool' | 'call_tool' | 'read_resource' | 'get_prompt' | 'admin';
  requestTime: string;
};
```

## Policy result

```ts
type PolicyDecisionResult = {
  allowed: boolean;
  reasonCode: string;
  reason: string;
  matchedGrantIds: string[];
  requiresApproval?: boolean;
  requiresStepUp?: boolean;
};
```

## Authorization rules

최소한 다음 규칙을 구현한다.

1. disabled server는 항상 deny
2. disabled tool은 항상 deny
3. expired grant는 deny
4. server-level connect grant가 없으면 deny
5. tools/list에서는 discover_tool 권한이 있는 tool만 노출
6. tools/call에서는 call_tool 권한을 재검증
7. high/critical risk tool은 explicit allow list가 있어야 함
8. prod environment는 별도 grant가 있어야 함
9. admin action은 platform admin role이 있어야 함

## Approval workflow

Control Plane API와 Web UI가 사용할 수 있도록 다음 상태를 구현한다.

```txt
pending
approved
rejected
cancelled
expired
```

Approval request 필드:

```txt
requester_id
subject_type
subject_id
project_id
server_id
requested_tools
environment
reason
ticket_url
requested_expires_at
status
reviewer_id
review_comment
created_at
updated_at
```

승인 시 `mcp_grants`를 생성한다.

## Emergency policy

운영자가 즉시 차단할 수 있는 emergency deny 정책을 구현한다.

- global deny all high/critical
- server deny
- tool deny
- subject deny
- client deny

## 완료 조건

- policy unit test 충분히 작성
- Gateway에서 packages/policy 사용
- API에서 approval approve 시 grant 생성
- Web UI에서 pending approval 처리 가능
- README에 policy model 설명
- docs/POLICY.md 작성
