import Link from "next/link";
import type { ReactNode } from "react";
import { StatusPill } from "@mcp-hub/ui";
import type { StatusTone } from "@mcp-hub/ui";

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
  MarketTrustLevel,
  MarketVisibility,
  ServerVersionStatus,
} from "../lib/api";
import {
  accessToolKey,
  type AccessStatus,
} from "../lib/access-status";
import {
  formatInstallMethods,
  formatMarketCategory,
  formatMarketTrustLevel,
  formatMarketVisibility,
  marketVisibilityForServer,
} from "../lib/market";
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
  showMarketCuration?: boolean;
  audience?: DisplayAudience;
}>;

export type DisplayAudience = "user" | "admin-summary" | "admin-detail";

export function ServerTable({ servers, healthByServerId, serverBasePath = "/user/servers", showMarketCuration = false, audience }: ServerTableProps) {
  const tableAudience = audience ?? (showMarketCuration ? "admin-summary" : "user");
  const showSummaryDiagnostics = tableAudience !== "user";

  return (
    <div className="table-wrap">
      <table>
        <caption>{tableAudience === "user" ? "사용자용 MCP 서버 요약" : "관리자용 MCP 서버 요약"}</caption>
        {showMarketCuration ? <MarketCurationTableHead /> : <ServerTableHead showSummaryDiagnostics={showSummaryDiagnostics} />}
        <tbody>
          {servers.map((server) => {
            const health = healthByServerId?.get(server.id);
            if (showMarketCuration) {
              return (
                <MarketCurationTableRow
                  audience={tableAudience}
                  health={health}
                  key={server.id}
                  server={server}
                  serverBasePath={serverBasePath}
                />
              );
            }

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
                {showSummaryDiagnostics ? <td>{server.slug}</td> : null}
                {showSummaryDiagnostics ? <td><TechnicalDetails summary="소유 팀 보기">{server.ownerTeamId}</TechnicalDetails></td> : null}
                <td>{formatEnvironment(server.environment)}</td>
                {showSummaryDiagnostics ? <td>{formatTransport(server.transport)}</td> : null}
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
                {showSummaryDiagnostics ? <td>
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
                </td> : null}
                {showSummaryDiagnostics ? <td>{formatDate(server.updatedAt)}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ServerTableHead({ showSummaryDiagnostics }: Readonly<{ showSummaryDiagnostics: boolean }>) {
  return (
    <thead>
      <tr>
        <th scope="col">서버</th>
        {showSummaryDiagnostics ? <th scope="col">슬러그</th> : null}
        {showSummaryDiagnostics ? <th scope="col">소유 팀</th> : null}
        <th scope="col">환경</th>
        {showSummaryDiagnostics ? <th scope="col">전송 방식</th> : null}
        <th scope="col">위험도</th>
        <th scope="col">상태</th>
        <th scope="col">활성 여부</th>
        {showSummaryDiagnostics ? <th scope="col">운영</th> : null}
        {showSummaryDiagnostics ? <th scope="col">업데이트</th> : null}
      </tr>
    </thead>
  );
}

function MarketCurationTableHead() {
  return (
    <thead>
      <tr>
        <th scope="col">서버</th>
        <th scope="col">카테고리/태그</th>
        <th scope="col">신뢰 수준</th>
        <th scope="col">게시/격리</th>
        <th scope="col">문서/설치</th>
        <th scope="col">운영 소유</th>
        <th scope="col">환경/상태</th>
        <th scope="col">위험도</th>
        <th scope="col">빠른 링크</th>
        <th scope="col">업데이트</th>
      </tr>
    </thead>
  );
}

function MarketCurationTableRow({ server, health, serverBasePath, audience }: Readonly<{ server: ApiMcpServer; health?: ApiServerHealth; serverBasePath: string; audience: DisplayAudience }>) {
  const visibility = marketVisibilityForServer(server);
  const docsUrl = safeExternalUrl(server.docsUrl);
  const sourceUrl = safeExternalUrl(server.sourceUrl);

  return (
    <tr>
      <td>
        <Link href={`${serverBasePath}/${server.id}`}>{server.displayName}</Link>
        <p className="muted">{server.slug}</p>
        <p className="muted">{server.summary ?? server.description ?? "마켓 요약이 없습니다."}</p>
      </td>
      <td>
        {formatMarketCategory(server.category)}
        <p className="muted">{formatTagSummary(server.tags)}</p>
      </td>
      <td>
        <StatusPill tone={marketTrustLevelTone(server.trustLevel)}>
          {formatMarketTrustLevel(server.trustLevel)}
        </StatusPill>
        <p className="muted">검토자 {server.reviewedBy ?? "기록 없음"}</p>
      </td>
      <td>
        <div className="actions">
          <StatusPill tone={marketVisibilityTone(visibility)}>
            {formatMarketVisibility(visibility)}
          </StatusPill>
          <StatusPill tone={server.published ? "success" : "warning"}>
            {server.published ? "게시됨" : "게시 안 됨"}
          </StatusPill>
          <StatusPill tone={server.quarantined ? "danger" : "neutral"}>
            {server.quarantined ? "격리됨" : "격리 안 됨"}
          </StatusPill>
        </div>
      </td>
      <td>
        <div className="actions">
          <StatusPill tone={docsUrl ? "success" : "warning"}>
            {docsUrl ? "문서 있음" : "문서 누락"}
          </StatusPill>
          <StatusPill tone={server.installMethods && server.installMethods.length > 0 ? "success" : "warning"}>
            {server.installMethods && server.installMethods.length > 0 ? "설치 있음" : "설치 누락"}
          </StatusPill>
        </div>
        <p className="muted">{formatInstallMethods(server.installMethods)}</p>
        {sourceUrl ? <p><a href={sourceUrl} target="_blank" rel="noreferrer">소스</a></p> : null}
      </td>
      <td>
        {audience === "admin-detail" ? server.ownerTeamId : <TechnicalDetails summary="소유 팀 보기">{server.ownerTeamId}</TechnicalDetails>}
      </td>
      <td>
        <p>{formatEnvironment(server.environment)}</p>
        <p className="muted">{formatTransport(server.transport)}</p>
        <div className="actions">
          {health ? (
            <StatusPill tone={healthTone(health.status)}>{formatHealthStatus(health.status)}</StatusPill>
          ) : (
            <StatusPill>확인 불가</StatusPill>
          )}
          <StatusPill tone={enabledTone(server.enabled)}>{formatEnabled(server.enabled)}</StatusPill>
        </div>
      </td>
      <td>
        <StatusPill tone={riskTone(server.riskLevel)}>{formatRiskLevel(server.riskLevel)}</StatusPill>
      </td>
      <td>
        <div className="actions">
          <Link className="button button--ghost" href={`${serverBasePath}/${server.id}`}>상세</Link>
          <Link className="button button--ghost" href={`${serverBasePath}/${server.id}#market-metadata`}>편집</Link>
          <Link className="button button--ghost" href={`/admin/audit?server=${encodeURIComponent(server.id)}`}>감사</Link>
        </div>
      </td>
      <td>{formatDate(server.updatedAt)}</td>
    </tr>
  );
}

function formatTagSummary(tags: string[] | undefined) {
  if (!tags || tags.length === 0) {
    return "태그 없음";
  }

  const visibleTags = tags.slice(0, 3).join(", ");
  const remaining = tags.length - 3;
  return remaining > 0 ? `${visibleTags} 외 ${remaining}개` : visibleTags;
}

function marketTrustLevelTone(value: MarketTrustLevel | undefined): StatusTone {
  if (value === "platform_supported" || value === "official") {
    return "success";
  }

  if (value === "verified") {
    return "info";
  }

  return "neutral";
}

function marketVisibilityTone(value: MarketVisibility): StatusTone {
  if (value === "published") {
    return "success";
  }

  if (value === "quarantined") {
    return "danger";
  }

  if (value === "draft" || value === "internal") {
    return "warning";
  }

  return "neutral";
}

export type ToolTableProps = Readonly<{
  tools: ApiMcpTool[];
  grantStatusByToolKey?: Map<string, string>;
  accessStatusByToolKey?: Map<string, AccessStatus>;
  showSchema?: boolean;
  showAccess?: boolean;
  showAdminPlaceholder?: boolean;
  actionSlot?: (tool: ApiMcpTool) => ReactNode;
  accessActionSlot?: (tool: ApiMcpTool, status: AccessStatus | undefined) => ReactNode;
  audience?: DisplayAudience;
}>;

export function ToolTable({
  tools,
  grantStatusByToolKey,
  accessStatusByToolKey,
  showSchema = false,
  showAccess = false,
  showAdminPlaceholder = false,
  actionSlot,
  accessActionSlot,
  audience = "user",
}: ToolTableProps) {
  const showTechnicalColumns = audience !== "user";
  const showSchemaColumn = showSchema && audience === "admin-detail";

  return (
    <div className="table-wrap">
      <table>
        <caption>{audience === "user" ? "사용자용 도구와 접근 상태" : "관리자용 도구 진단"}</caption>
        <thead>
          <tr>
            <th scope="col">도구</th>
            <th scope="col">위험도</th>
            <th scope="col">상태</th>
            {showSchemaColumn ? <th scope="col">입력 스키마</th> : null}
            {showAccess ? <th scope="col">접근 권한</th> : null}
            {showTechnicalColumns ? <th scope="col">발견 시각</th> : null}
            {showTechnicalColumns ? <th scope="col">마지막 확인</th> : null}
            {showAdminPlaceholder ? <th scope="col">관리자 테스트</th> : null}
            {actionSlot ? <th scope="col">제어</th> : null}
          </tr>
        </thead>
        <tbody>
          {tools.map((tool) => {
            const key = accessToolKey(tool);
            const accessStatus = accessStatusByToolKey?.get(key);
            return (
            <tr key={tool.id}>
              <td>
                {tool.name}
                <p className="muted">
                  {tool.description ?? "서버가 공개한 설명이 없습니다."}
                </p>
              </td>
              <td>
                <ToolRiskCell tool={tool} />
              </td>
              <td>
                <StatusPill tone={enabledTone(tool.enabled)}>
                  {formatEnabled(tool.enabled)}
                </StatusPill>
              </td>
              {showSchemaColumn ? (
                <td>
                  <SchemaViewer tool={tool} />
                </td>
              ) : null}
              {showAccess ? (
                <td>
                  <ToolAccessCell
                    status={accessStatus}
                    fallback={grantStatusByToolKey?.get(key)}
                    action={accessActionSlot?.(tool, accessStatus)}
                  />
                </td>
              ) : null}
              {showTechnicalColumns ? <td>{formatDate(tool.discoveredAt)}</td> : null}
              {showTechnicalColumns ? <td>{formatDate(tool.lastSeenAt)}</td> : null}
              {showAdminPlaceholder ? (
                <td>
                  <StatusPill tone="info">API 대기</StatusPill>
                  <p className="muted">
                    관리자 테스트 호출 API가 제공되면 이 영역에서 연결합니다.
                  </p>
                </td>
              ) : null}
              {actionSlot ? <td>{actionSlot(tool)}</td> : null}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ToolRiskCell({ tool }: Readonly<{ tool: ApiMcpTool }>) {
  return (
    <div className="grid">
      <StatusPill tone={riskTone(tool.riskLevel)}>
        {formatRiskLevel(tool.riskLevel)}
      </StatusPill>
      <p className="muted">{riskExplanation(tool.riskLevel)}</p>
    </div>
  );
}

function ToolAccessCell({
  status,
  fallback,
  action,
}: Readonly<{
  status: AccessStatus | undefined;
  fallback: string | undefined;
  action: ReactNode;
}>) {
  if (!status) {
    return <span>{fallback ?? "활성 권한이 없습니다"}</span>;
  }

  return (
    <div className="grid">
      <StatusPill tone={status.tone}>{status.label}</StatusPill>
      <p className="muted">{status.actionHint}</p>
      {status.wildcardGrant ? (
        <p className="muted">
          허용 도구 *는 특정 도구명 없이 이 서버의 도구 전체와 매칭됩니다.
        </p>
      ) : null}
      {action}
    </div>
  );
}

function riskExplanation(riskLevel: ApiMcpTool["riskLevel"]) {
  if (riskLevel === "critical") {
    return "심각 위험 도구는 명시적 승인, 검토 의견, 필요 시 스텝업 확인이 필요합니다.";
  }

  if (riskLevel === "high") {
    return "높은 위험 도구는 요청 사유와 만료 범위를 명확히 적어야 합니다.";
  }

  if (riskLevel === "medium") {
    return "중간 위험 도구는 팀 또는 사용자 grant와 도구명이 일치해야 합니다.";
  }

  return "낮은 위험 도구도 활성 grant 또는 와일드카드 grant 범위 안에서만 허용됩니다.";
}

export function ServerVersionTable({
  versions,
}: Readonly<{ versions: ApiMcpServerVersion[] }>) {
  return (
    <div className="table-wrap">
      <table>
        <caption>서버 버전과 롤아웃 진단</caption>
        <thead>
          <tr>
            <th scope="col">버전</th>
            <th scope="col">상태</th>
            <th scope="col">이미지/해시 세부정보</th>
            <th scope="col">생성</th>
            <th scope="col">활성화</th>
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
                <TechnicalDetails summary="해시 보기">
                  <p>{version.configHash ?? "설정 해시 기록 없음"}</p>
                  <p className="muted">
                    스키마 {version.toolSchemaHash ?? "기록 없음"}
                  </p>
                </TechnicalDetails>
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
  serverBasePath = "/admin/servers",
}: Readonly<{ rows: RolloutStatusRow[]; serverBasePath?: string }>) {
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
                <Link href={`${serverBasePath}/${row.server.id}`}>
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
  audience = "admin-summary",
}: Readonly<{
  grants: ApiGrant[];
  serverNameById: Map<string, string>;
  actionSlot?: (grant: ApiGrant) => ReactNode;
  audience?: DisplayAudience;
}>) {
  return (
    <div className="table-wrap">
      <table>
        <caption>{audience === "user" ? "내 접근 권한 요약" : "관리자 권한 목록"}</caption>
        <thead>
          <tr>
            <th scope="col">주체</th>
            <th scope="col">서버</th>
            <th scope="col">도구</th>
            <th scope="col">환경</th>
            <th scope="col">상태</th>
            <th scope="col">사유</th>
            {actionSlot ? <th scope="col">제어</th> : null}
          </tr>
        </thead>
        <tbody>
          {grants.map((grant) => (
            <tr key={grant.id}>
              <td>
                {audience === "user" ? formatSubjectType(grant.subjectType) : `${formatSubjectType(grant.subjectType)}: ${grant.subjectId}`}
                {audience === "user" ? <p className="muted">현재 세션과 일치</p> : null}
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

export type ApprovalDecisionContext = Readonly<{
  serverDisplayName?: string;
  serverCategory?: string;
  serverEnvironment?: string;
  serverRiskLevel?: ApiMcpServer["riskLevel"];
  requestedToolRisks: ReadonlyArray<Readonly<{
    toolName: string;
    riskLevel?: ApiMcpTool["riskLevel"];
    enabled?: boolean;
  }>>;
  grantOverlaps: ReadonlyArray<Readonly<{
    grantId: string;
    subjectId: string;
    allowedTools: readonly string[];
    wildcard: boolean;
  }>>;
  reviewCommentRequired: boolean;
}>;

export function ApprovalTable({
  approvals,
  actionSlot,
  serverNameById,
  contextByApprovalId,
}: Readonly<{
  approvals: ApiApproval[];
  actionSlot?: (approval: ApiApproval) => ReactNode;
  serverNameById?: Map<string, string>;
  contextByApprovalId?: Map<string, ApprovalDecisionContext>;
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
            const context = contextByApprovalId?.get(approval.id);
            const showDecisionContext = contextByApprovalId !== undefined;

            return (
              <tr key={approval.id}>
                <td>
                  {formatSubjectType(approval.subjectType)}: {approval.subjectId}
                  <p className="muted">요청자 {approval.requesterId}</p>
                </td>
                <td>
                  {context?.serverDisplayName ?? serverNameById?.get(approval.serverId) ?? approval.serverId}
                  {context?.serverDisplayName ? (
                    <p className="muted">{approval.serverId}</p>
                  ) : null}
                  <p className="muted">프로젝트 {approval.projectId}</p>
                  {showDecisionContext ? <ApprovalServerContext context={context} /> : null}
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
                  {showDecisionContext ? <ApprovalToolContext context={context} /> : null}
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

function ApprovalServerContext({
  context,
}: Readonly<{ context: ApprovalDecisionContext | undefined }>) {
  if (!context) {
    return <p className="muted">서버 컨텍스트를 결합하지 못했습니다.</p>;
  }

  return (
    <div className="grid">
      <div className="actions">
        {context.serverRiskLevel ? (
          <StatusPill tone={riskTone(context.serverRiskLevel)}>
            {formatRiskLevel(context.serverRiskLevel)}
          </StatusPill>
        ) : null}
        {context.serverEnvironment ? (
          <StatusPill>{formatEnvironment(context.serverEnvironment)}</StatusPill>
        ) : null}
      </div>
      <p className="muted">카테고리 {context.serverCategory ?? "확인 불가"}</p>
      {context.grantOverlaps.length > 0 ? (
        <p className="muted">
          기존 grant {context.grantOverlaps.length}개와 요청 범위가 겹칩니다.
          {context.grantOverlaps.some((grant) => grant.wildcard)
            ? " 와일드카드 grant(*) 포함."
            : ""}
        </p>
      ) : (
        <p className="muted">현재 같은 주체/프로젝트/도구와 겹치는 grant가 없습니다.</p>
      )}
    </div>
  );
}

function ApprovalToolContext({
  context,
}: Readonly<{ context: ApprovalDecisionContext | undefined }>) {
  if (!context) {
    return null;
  }

  return (
    <div className="grid">
      <div className="actions">
        {context.requestedToolRisks.map((tool) => (
          <StatusPill tone={tool.riskLevel ? riskTone(tool.riskLevel) : "neutral"} key={tool.toolName}>
            {tool.toolName}: {tool.riskLevel ? formatRiskLevel(tool.riskLevel) : "위험도 확인 불가"}
          </StatusPill>
        ))}
      </div>
      {context.requestedToolRisks.some((tool) => tool.enabled === false) ? (
        <p className="muted">비활성 도구가 포함되어 승인 전 활성화 상태를 확인해야 합니다.</p>
      ) : null}
      {context.reviewCommentRequired ? (
        <p className="muted">높음/심각 위험 요청이므로 검토 의견을 남기는 것이 필요합니다.</p>
      ) : null}
    </div>
  );
}

function TechnicalDetails({ summary, children }: Readonly<{ summary: string; children: ReactNode }>) {
  return (
    <details className="schema-viewer">
      <summary>{summary}</summary>
      <div className="grid">{children}</div>
    </details>
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

export function AuditTable({ events, auditBasePath = "/admin/audit" }: Readonly<{ events: ApiAuditEvent[]; auditBasePath?: string }>) {
  return (
    <div className="table-wrap">
      <table>
        <caption>정책 감사 이벤트와 진단 세부정보</caption>
        <thead>
          <tr>
            <th scope="col">이벤트</th>
            <th scope="col">정책</th>
            <th scope="col">위험도</th>
            <th scope="col">행위자</th>
            <th scope="col">실행</th>
            <th scope="col">진단 세부정보</th>
            <th scope="col">시각</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>
                <StatusPill tone={auditEventTone(event.eventType)}>{auditEventLabel(event.eventType)}</StatusPill>
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
                <details className="schema-viewer">
                  <summary>추적·해시·페이로드 보기</summary>
                  <div className="grid">
                    <div className="copy-control">
                      <span className="muted">추적 ID</span>
                      <CopyButton value={event.traceId} label="추적 ID 복사" />
                      <Link
                        className="button button--ghost"
                        href={`${auditBasePath}?trace_id=${encodeURIComponent(event.traceId)}`}
                      >
                        추적 링크
                      </Link>
                    </div>
                    <p>{event.argumentHash ? <code>{event.argumentHash}</code> : <span className="muted">인자 해시 기록 없음</span>}</p>
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
                  </div>
                </details>
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

function auditEventLabel(eventType: string) {
  if (eventType.startsWith("tool.")) {
    return "도구 호출";
  }

  if (eventType.startsWith("admin.")) {
    return "관리자 작업";
  }

  if (eventType.startsWith("policy.")) {
    return "정책 이벤트";
  }

  return eventType;
}

function auditEventTone(eventType: string): StatusTone {
  if (eventType.startsWith("tool.")) {
    return "info";
  }

  if (eventType.startsWith("admin.")) {
    return "warning";
  }

  return "neutral";
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

function isSuccessfulToolCallStatus(status: string) {
  const normalized = status.toLowerCase();
  return (
    normalized === "ok" ||
    normalized === "success" ||
    normalized === "succeeded"
  );
}
