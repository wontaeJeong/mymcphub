import Link from "next/link";
import type { ReactNode } from "react";
import { StatusPill } from "@mcp-hub/ui";

import { CopyButton } from "./copy-button";
import type {
  ApiApproval,
  ApiAuditEvent,
  ApiGrant,
  ApiMcpServer,
  ApiMcpServerVersion,
  ApiMcpTool,
  ApiServerHealth,
  ApiToolCallEvent,
  ServerVersionStatus,
} from "../lib/api";
import {
  approvalTone,
  enabledTone,
  formatApprovalStatus,
  formatDate,
  formatEnabled,
  formatEnvironment,
  formatGrantStatus,
  formatHealthStatus,
  formatPolicyEffect,
  formatRiskLevel,
  formatServerVersionStatus,
  formatSubjectType,
  formatToolCallStatus,
  formatTransport,
  healthTone,
  policyTone,
  riskTone,
} from "./format";

export type ServerTableProps = Readonly<{
  servers: ApiMcpServer[];
  healthByServerId?: Map<string, ApiServerHealth>;
  serverBasePath?: string;
}>;

export function ServerTable({ servers, healthByServerId, serverBasePath = "/servers" }: ServerTableProps) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>서버</th>
            <th>슬러그</th>
            <th>소유 팀</th>
            <th>환경</th>
            <th>전송 방식</th>
            <th>위험도</th>
            <th>상태</th>
            <th>활성 여부</th>
            <th>운영</th>
            <th>업데이트</th>
          </tr>
        </thead>
        <tbody>
          {servers.map((server) => {
            const health = healthByServerId?.get(server.id);
            return (
              <tr key={server.id}>
                <td>
                  <Link href={`${serverBasePath}/${server.id}`}>
                    {server.displayName}
                  </Link>
                  <p className="muted">
                    {server.description ?? "공개된 설명이 없습니다."}
                  </p>
                </td>
                <td>{server.slug}</td>
                <td>{server.ownerTeamId}</td>
                <td>{formatEnvironment(server.environment)}</td>
                <td>{formatTransport(server.transport)}</td>
                <td>
                  <StatusPill tone={riskTone(server.riskLevel)}>
                    {formatRiskLevel(server.riskLevel)}
                  </StatusPill>
                </td>
                <td>
                  {health ? (
                    <StatusPill tone={healthTone(health.status)}>
                      {formatHealthStatus(health.status)}
                    </StatusPill>
                  ) : (
                    <StatusPill>확인 불가</StatusPill>
                  )}
                </td>
                <td>
                  <StatusPill tone={enabledTone(server.enabled)}>
                    {formatEnabled(server.enabled)}
                  </StatusPill>
                </td>
                <td>
                  <div className="actions">
                    <StatusPill
                      tone={
                        server.published
                          ? "success"
                          : server.published === false
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {server.published
                        ? "게시됨"
                        : server.published === false
                          ? "게시 안 됨"
                          : "게시 상태 없음"}
                    </StatusPill>
                    <StatusPill tone={server.quarantined ? "danger" : "neutral"}>
                      {server.quarantined ? "격리됨" : "격리 안 됨"}
                    </StatusPill>
                  </div>
                </td>
                <td>{formatDate(server.updatedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export type ToolTableProps = Readonly<{
  tools: ApiMcpTool[];
  grantStatusByToolKey?: Map<string, string>;
  showSchema?: boolean;
  showAccess?: boolean;
  showAdminPlaceholder?: boolean;
  actionSlot?: (tool: ApiMcpTool) => ReactNode;
}>;

export function ToolTable({
  tools,
  grantStatusByToolKey,
  showSchema = false,
  showAccess = false,
  showAdminPlaceholder = false,
  actionSlot,
}: ToolTableProps) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>도구</th>
            <th>위험도</th>
            <th>상태</th>
            {showSchema ? <th>입력 스키마</th> : null}
            {showAccess ? <th>접근 권한</th> : null}
            <th>발견 시각</th>
            <th>마지막 확인</th>
            {showAdminPlaceholder ? <th>관리자 테스트</th> : null}
            {actionSlot ? <th>제어</th> : null}
          </tr>
        </thead>
        <tbody>
          {tools.map((tool) => (
            <tr key={tool.id}>
              <td>
                {tool.name}
                <p className="muted">
                  {tool.description ?? "서버가 공개한 설명이 없습니다."}
                </p>
              </td>
              <td>
                <StatusPill tone={riskTone(tool.riskLevel)}>
                  {formatRiskLevel(tool.riskLevel)}
                </StatusPill>
              </td>
              <td>
                <StatusPill tone={enabledTone(tool.enabled)}>
                  {formatEnabled(tool.enabled)}
                </StatusPill>
              </td>
              {showSchema ? (
                <td>
                  <SchemaViewer tool={tool} />
                </td>
              ) : null}
              {showAccess ? (
                <td>
                  {grantStatusByToolKey?.get(toolKey(tool)) ??
                    "활성 권한이 없습니다"}
                </td>
              ) : null}
              <td>{formatDate(tool.discoveredAt)}</td>
              <td>{formatDate(tool.lastSeenAt)}</td>
              {showAdminPlaceholder ? (
                <td>
                  <StatusPill tone="info">API 대기</StatusPill>
                  <p className="muted">
                    관리자 테스트 호출 엔드포인트는 prompt 05 범위에 없습니다.
                  </p>
                </td>
              ) : null}
              {actionSlot ? <td>{actionSlot(tool)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ServerVersionTable({
  versions,
}: Readonly<{ versions: ApiMcpServerVersion[] }>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>버전</th>
            <th>상태</th>
            <th>이미지</th>
            <th>해시</th>
            <th>생성</th>
            <th>활성화</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((version) => (
            <tr key={version.id}>
              <td>
                {version.version}
                <p className="muted">
                  {version.createdBy
                    ? `생성자 ${version.createdBy}`
                    : "생성자 기록 없음"}
                </p>
              </td>
              <td>
                <StatusPill tone={serverVersionTone(version.status)}>
                  {formatServerVersionStatus(version.status)}
                </StatusPill>
              </td>
              <td>
                <VersionImage version={version} />
              </td>
              <td>
                <p>{version.configHash ?? "설정 해시 기록 없음"}</p>
                <p className="muted">
                  스키마 {version.toolSchemaHash ?? "기록 없음"}
                </p>
              </td>
              <td>{formatDate(version.createdAt)}</td>
              <td>{formatDate(version.activatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type RolloutStatusRow = Readonly<{
  server: ApiMcpServer;
  activeVersion?: ApiMcpServerVersion;
  latestVersion?: ApiMcpServerVersion;
  health?: ApiServerHealth;
}>;

export function RolloutStatusTable({
  rows,
}: Readonly<{ rows: RolloutStatusRow[] }>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>서버</th>
            <th>활성 버전</th>
            <th>최신 롤아웃</th>
            <th>상태</th>
            <th>격리</th>
            <th>업데이트</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.server.id}>
              <td>
                <Link href={`/servers/${row.server.id}`}>
                  {row.server.displayName}
                </Link>
                <p className="muted">
                  {row.server.slug} · {formatEnvironment(row.server.environment)}
                </p>
              </td>
              <td>
                {row.activeVersion ? (
                  <StatusPill tone="success">
                    {row.activeVersion.version}
                  </StatusPill>
                ) : (
                  <span className="muted">활성 버전 없음</span>
                )}
              </td>
              <td>
                {row.latestVersion ? (
                  <StatusPill tone={serverVersionTone(row.latestVersion.status)}>
                    {formatServerVersionStatus(row.latestVersion.status)}
                  </StatusPill>
                ) : (
                  <span className="muted">롤아웃 기록 없음</span>
                )}
              </td>
              <td>
                {row.health ? (
                  <StatusPill tone={healthTone(row.health.status)}>
                    {formatHealthStatus(row.health.status)}
                  </StatusPill>
                ) : (
                  <StatusPill>상태 확인 불가</StatusPill>
                )}
              </td>
              <td>
                <div className="actions">
                  <StatusPill tone={enabledTone(row.server.enabled)}>
                    {formatEnabled(row.server.enabled)}
                  </StatusPill>
                  <StatusPill
                    tone={row.server.quarantined ? "danger" : "neutral"}
                  >
                    {row.server.quarantined ? "격리됨" : "격리 안 됨"}
                  </StatusPill>
                </div>
              </td>
              <td>{formatDate(row.server.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GrantTable({
  grants,
  serverNameById,
  actionSlot,
}: Readonly<{
  grants: ApiGrant[];
  serverNameById: Map<string, string>;
  actionSlot?: (grant: ApiGrant) => ReactNode;
}>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>주체</th>
            <th>서버</th>
            <th>도구</th>
            <th>환경</th>
            <th>상태</th>
            <th>사유</th>
            {actionSlot ? <th>제어</th> : null}
          </tr>
        </thead>
        <tbody>
          {grants.map((grant) => (
            <tr key={grant.id}>
              <td>
                {formatSubjectType(grant.subjectType)}: {grant.subjectId}
              </td>
              <td>{serverNameById.get(grant.serverId) ?? grant.serverId}</td>
              <td>{grant.allowedTools.join(", ")}</td>
              <td>{formatEnvironment(grant.environment)}</td>
              <td>
                <StatusPill tone={enabledTone(grant.enabled)}>
                  {formatGrantStatus(grant.enabled)}
                </StatusPill>
              </td>
              <td>{grant.reason}</td>
              {actionSlot ? <td>{actionSlot(grant)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ApprovalTable({
  approvals,
  actionSlot,
}: Readonly<{
  approvals: ApiApproval[];
  actionSlot?: (approval: ApiApproval) => ReactNode;
}>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>주체</th>
            <th>범위</th>
            <th>요청</th>
            <th>상태</th>
            <th>시각</th>
            <th>결정</th>
          </tr>
        </thead>
        <tbody>
          {approvals.map((approval) => {
            const ticketUrl = safeExternalUrl(approval.ticketUrl);

            return (
              <tr key={approval.id}>
                <td>
                  {formatSubjectType(approval.subjectType)}: {approval.subjectId}
                  <p className="muted">요청자 {approval.requesterId}</p>
                </td>
                <td>
                  {approval.serverId}
                  <p className="muted">프로젝트 {approval.projectId}</p>
                </td>
                <td>
                  {approval.requestedAction}
                  <p className="muted">
                    {formatList(approval.requestedTools)} ·{" "}
                    {formatEnvironment(approval.environment)}
                  </p>
                  {ticketUrl ? (
                    <p>
                      <a href={ticketUrl} target="_blank" rel="noreferrer">
                        티켓
                      </a>
                    </p>
                  ) : null}
                  {approval.requestedExpiresAt ? (
                    <p className="muted">
                      요청 만료 {formatDate(approval.requestedExpiresAt)}
                    </p>
                  ) : null}
                  <p className="muted">{approval.reason}</p>
                </td>
                <td>
                  <StatusPill tone={approvalTone(approval.status)}>
                    {formatApprovalStatus(approval.status)}
                  </StatusPill>
                </td>
                <td>
                  {formatDate(approval.createdAt)}
                  <p className="muted">
                    업데이트 {formatDate(approval.updatedAt)}
                  </p>
                </td>
                <td>
                  {actionSlot ? (
                    actionSlot(approval)
                  ) : (
                    <ApprovalDecision approval={approval} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VersionImage({ version }: Readonly<{ version: ApiMcpServerVersion }>) {
  if (version.imageRef) {
    return <span>{version.imageRef}</span>;
  }

  if (version.imageRepository || version.imageTag || version.imageDigest) {
    return (
      <div>
        <p>{version.imageRepository ?? "이미지 저장소 기록 없음"}</p>
        <p className="muted">
          {version.imageTag ?? version.imageDigest ?? "이미지 태그 기록 없음"}
        </p>
      </div>
    );
  }

  return <span className="muted">이미지 기록 없음</span>;
}

function serverVersionTone(status: ServerVersionStatus) {
  if (status === "active") {
    return "success";
  }

  if (status === "pending" || status === "draft") {
    return "warning";
  }

  if (status === "deprecated" || status === "rolled_back") {
    return "neutral";
  }

  return "danger";
}

function ApprovalDecision({ approval }: Readonly<{ approval: ApiApproval }>) {
  if (!approval.decidedAt && !approval.reviewerId && !approval.reviewComment) {
    return <span className="muted">결정 전</span>;
  }

  return (
    <div>
      {approval.reviewerId ? <p>검토자 {approval.reviewerId}</p> : null}
      {approval.decidedAt ? (
        <p className="muted">결정 {formatDate(approval.decidedAt)}</p>
      ) : null}
      {approval.reviewComment ? (
        <p className="muted">{approval.reviewComment}</p>
      ) : null}
    </div>
  );
}

function formatList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "요청한 모든 도구";
}

function safeExternalUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? value
      : undefined;
  } catch (caught: unknown) {
    if (caught instanceof TypeError) {
      return undefined;
    }
    throw caught;
  }
}

export function AuditTable({ events }: Readonly<{ events: ApiAuditEvent[] }>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>이벤트</th>
            <th>정책</th>
            <th>위험도</th>
            <th>행위자</th>
            <th>실행</th>
            <th>인자 해시</th>
            <th>추적</th>
            <th>마스킹된 페이로드</th>
            <th>시각</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>
                {event.eventType}
                <p className="muted">
                  {event.toolName ?? event.serverId ?? "허브 범위"}
                </p>
              </td>
              <td>
                <StatusPill tone={policyTone(event.policyDecision)}>
                  {formatPolicyEffect(event.policyDecision)}
                </StatusPill>
              </td>
              <td>
                <StatusPill tone={riskTone(event.riskLevel)}>
                  {formatRiskLevel(event.riskLevel)}
                </StatusPill>
              </td>
              <td>{event.userId ?? event.clientId ?? "알 수 없음"}</td>
              <td>
                <AuditExecution event={event} />
              </td>
              <td>
                {event.argumentHash ? (
                  <code>{event.argumentHash}</code>
                ) : (
                  <span className="muted">기록 없음</span>
                )}
              </td>
              <td>
                <CopyButton value={event.traceId} label="추적 ID 복사" />
                <Link
                  className="button button--ghost"
                  href={`/audit?trace_id=${encodeURIComponent(event.traceId)}`}
                >
                  추적 링크
                </Link>
              </td>
              <td>
                <RedactedJsonDetails
                  summary="마스킹된 인자 보기"
                  value={event.argumentRedactedJson}
                  emptyText="마스킹된 인자가 없습니다"
                />
                <RedactedJsonDetails
                  summary="마스킹된 메타데이터 보기"
                  value={event.metadataJson}
                  emptyText="메타데이터가 없습니다"
                />
              </td>
              <td>{formatDate(event.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditExecution({ event }: Readonly<{ event: ApiAuditEvent }>) {
  return (
    <div>
      <p>
        {event.latencyMs === undefined ? (
          <span className="muted">지연 시간 없음</span>
        ) : (
          `${event.latencyMs} ms`
        )}
      </p>
      {event.upstreamStatus === undefined ? (
        <p className="muted">업스트림 없음</p>
      ) : (
        <StatusPill tone={event.upstreamStatus < 400 ? "success" : "warning"}>
          {event.upstreamStatus}
        </StatusPill>
      )}
      {event.errorCode ? <p className="muted">오류 {event.errorCode}</p> : null}
    </div>
  );
}

export function ToolCallTable({
  events,
  serverNameById,
}: Readonly<{
  events: ApiToolCallEvent[];
  serverNameById: Map<string, string>;
}>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>도구</th>
            <th>서버</th>
            <th>상태</th>
            <th>지연 시간</th>
            <th>생성</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>{event.toolName}</td>
              <td>{serverNameById.get(event.serverId) ?? event.serverId}</td>
              <td>
                <StatusPill
                  tone={
                    isSuccessfulToolCallStatus(event.status)
                      ? "success"
                      : "warning"
                  }
                >
                  {formatToolCallStatus(event.status)}
                </StatusPill>
              </td>
              <td>
                {event.latencyMs === undefined
                  ? "해당 없음"
                  : `${event.latencyMs} ms`}
              </td>
              <td>{formatDate(event.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HealthTable({
  checks,
  serverNameById,
}: Readonly<{
  checks: ApiServerHealth[];
  serverNameById: Map<string, string>;
}>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>서버</th>
            <th>상태</th>
            <th>지연 시간</th>
            <th>백오프</th>
            <th>오류</th>
            <th>추적</th>
            <th>확인 시각</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={check.id}>
              <td>{serverNameById.get(check.serverId) ?? check.serverId}</td>
              <td>
                <StatusPill tone={healthTone(check.status)}>
                  {formatHealthStatus(check.status)}
                </StatusPill>
              </td>
              <td>
                {check.latencyMs === undefined
                  ? "해당 없음"
                  : `${check.latencyMs} ms`}
              </td>
              <td>
                {check.backoffSeconds
                  ? `${check.backoffSeconds}초, ${check.attempt ?? 1}회차 이후`
                  : "없음"}
              </td>
              <td>{check.errorMessage ?? "없음"}</td>
              <td>
                {check.traceId ? (
                  <CopyButton value={check.traceId} label="추적 ID 복사" />
                ) : (
                  <span className="muted">해당 없음</span>
                )}
              </td>
              <td>{formatDate(check.checkedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SchemaViewer({ tool }: Readonly<{ tool: ApiMcpTool }>) {
  const schema = tool.inputSchema ?? tool.inputSchemaJson;
  if (schema === undefined) {
    return <span className="muted">제어 플레인 API에서 확인할 수 없습니다</span>;
  }

  return (
    <details className="schema-viewer">
      <summary>스키마 보기</summary>
      <pre className="code-block">{JSON.stringify(schema, null, 2)}</pre>
    </details>
  );
}

function RedactedJsonDetails({
  summary,
  value,
  emptyText,
}: Readonly<{ summary: string; value: unknown; emptyText: string }>) {
  if (value === undefined || value === null) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <details className="schema-viewer">
      <summary>{summary}</summary>
      <pre className="code-block">
        {JSON.stringify(redactAuditJson(value), null, 2)}
      </pre>
    </details>
  );
}

function redactAuditJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactAuditJson(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(
      ([key, nestedValue]) => [
        key,
        isSensitiveMetadataKey(key)
          ? "[REDACTED]"
          : redactAuditJson(nestedValue),
      ],
    ),
  );
}

function isSensitiveMetadataKey(key: string) {
  const normalized = key.toLowerCase();
  return (
    normalized.includes("token") ||
    normalized.includes("secret") ||
    normalized.includes("password") ||
    normalized.includes("authorization") ||
    normalized.includes("credential") ||
    normalized.endsWith("key")
  );
}

function toolKey(tool: ApiMcpTool) {
  return `${tool.serverId}:${tool.name}`;
}

function isSuccessfulToolCallStatus(status: string) {
  const normalized = status.toLowerCase();
  return (
    normalized === "ok" ||
    normalized === "success" ||
    normalized === "succeeded"
  );
}
