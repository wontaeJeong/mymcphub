import Link from "next/link";
import { EmptyState, StatusPill, Surface } from "@mcp-hub/ui";
import type { StatusTone } from "@mcp-hub/ui";

import {
  disableServerAction,
  disableToolAction,
  enableServerAction,
  enableToolAction,
} from "../../actions";
import { PageHero, SectionHeader } from "../../../components/chrome";
import {
  enabledTone,
  formatDate,
  formatEnabled,
  formatEnvironment,
  formatHealthStatus,
  formatRiskLevel,
  formatServerVersionStatus,
  formatTransport,
  healthTone,
  riskTone,
} from "../../../components/format";
import { EyeIcon, PowerIcon, ServerIcon } from "../../../components/icons";
import { ServerMarketCurationForm } from "../../../components/server-market-curation-form";
import { ErrorState } from "../../../components/states";
import {
  AuditTable,
  ServerVersionTable,
  ToolTable,
} from "../../../components/tables";
import { ToolTestLab } from "../../../components/tool-test-lab";
import type { ApiMcpServerVersion, ApiMcpTool } from "../../../lib/api";
import {
  getServer,
  listAuditEvents,
  listGrants,
  listServerHealth,
  listServerVersions,
  listTools,
} from "../../../lib/api";
import { loadResult } from "../../../lib/result";
import { buildGrantStatus, buildToolTestOptions } from "../../tools/page-helpers";
import {
  selectActiveServerVersion,
  selectRecentServerAuditEvents,
  selectServerHealth,
} from "./page-helpers";

type ServerDetailPageProps = Readonly<{
  params: Promise<{ serverId: string }>;
}>;

export async function AdminServerDetailPageContent({ params }: ServerDetailPageProps) {
  const { serverId } = await params;
  const serverPromise = loadResult(getServer(serverId));
  const toolsPromise = loadResult(listTools(serverId));
  const healthPromise = loadResult(listServerHealth());
  const auditPromise = loadResult(listAuditEvents({ limit: 50, server: serverId }));
  const versionsPromise = loadResult(listServerVersions(serverId));
  const grantsPromise = loadResult(listGrants());
  const [server, tools, health, audit, versions, grants] = await Promise.all([
    serverPromise,
    toolsPromise,
    healthPromise,
    auditPromise,
    versionsPromise,
    grantsPromise,
  ]);

  if (!server.ok) {
    return (
      <div className="page-stack">
        <PageHero
          eyebrow="서버 상세"
          title="서버를 찾을 수 없습니다."
          description="카탈로그에서 다시 선택하세요."
        />
        <ErrorState message={server.error} />
        <Link className="button" href="/admin/servers">
          <EyeIcon />
          카탈로그로 돌아가기
        </Link>
      </div>
    );
  }

  const latestHealth = health.ok
    ? selectServerHealth(health.data.items, serverId)
    : undefined;
  const recentAudit = audit.ok ? selectRecentServerAuditEvents(audit.data.items) : [];
  const versionItems = versions.ok ? versions.data.items : [];
  const activeVersion = versions.ok
    ? selectActiveServerVersion(versionItems)
    : undefined;
  const toolItems = tools.ok ? tools.data.items : [];
  const grantStatusByToolKey = buildGrantStatus(
    toolItems,
    grants.ok ? grants.data.items : undefined,
  );
  const toolTestOptions = buildToolTestOptions([server.data], toolItems);

  return (
    <div className="page-stack">
      <PageHero
        eyebrow={server.data.slug}
        title={server.data.displayName}
        description={server.data.description ?? "설명이 등록되지 않았습니다."}
      />
      <div className="detail-grid">
        <Surface>
          <SectionHeader
            title="서버 요약"
            description="운영 판단에 필요한 상태를 먼저 보여주고 기술 세부정보는 펼쳐 확인합니다."
          />
          <div className="grid">
            <p>
              <strong>환경:</strong> {formatEnvironment(server.data.environment)}
            </p>
            <p>
              <strong>전송 방식:</strong> {formatTransport(server.data.transport)}
            </p>
            <details className="schema-viewer">
              <summary>기술 세부정보 보기</summary>
              <div className="grid">
                <p><strong>서버 ID:</strong> {server.data.id}</p>
                <p><strong>소유 팀:</strong> {server.data.ownerTeamId}</p>
                <p><strong>업스트림 URL:</strong> {server.data.upstreamUrl ?? "정보 없음"}</p>
                <p><strong>스키마 버전:</strong> {server.data.schemaVersion ?? "정보 없음"}</p>
                <p><strong>생성:</strong> {formatDate(server.data.createdAt)}</p>
                <p><strong>업데이트:</strong> {formatDate(server.data.updatedAt)}</p>
              </div>
            </details>
          </div>
        </Surface>
        <Surface className="panel--accent danger-zone">
          <SectionHeader
            title="위험도 및 운영 제어"
            description="서버 활성 상태를 관리합니다."
            action={<span className="heading-icon heading-icon--danger"><ServerIcon /></span>}
          />
          <div className="grid">
            <div className="actions">
              <StatusPill tone={riskTone(server.data.riskLevel)}>
                {formatRiskLevel(server.data.riskLevel)}
              </StatusPill>
              <StatusPill tone={enabledTone(server.data.enabled)}>
                {formatEnabled(server.data.enabled)}
              </StatusPill>
              {latestHealth ? (
                <StatusPill tone={healthTone(latestHealth.status)}>
                  {formatHealthStatus(latestHealth.status)}
                </StatusPill>
              ) : (
                <StatusPill>상태 없음</StatusPill>
              )}
            </div>
            {latestHealth ? (
              <p className="muted">
                최근 상태 확인: {formatDate(latestHealth.checkedAt)}
                {latestHealth.errorMessage ? ` · ${latestHealth.errorMessage}` : ""}
              </p>
            ) : (
              <p className="muted">
                이 서버에 대한 상태 확인 결과가 아직 없습니다.
              </p>
            )}
            <div className="actions">
              <form action={enableServerAction}>
                <input type="hidden" name="serverId" value={server.data.id} />
                <label className="danger-confirm">
                  <input type="checkbox" required disabled={server.data.enabled} />
                  활성화하면 Gateway 경로에 다시 노출될 수 있음을 확인합니다.
                </label>
                <button
                  className="button"
                  type="submit"
                  disabled={server.data.enabled}
                >
                  <PowerIcon />서버 활성화
                </button>
              </form>
              <form action={disableServerAction}>
                <input type="hidden" name="serverId" value={server.data.id} />
                <label className="danger-confirm">
                  <input type="checkbox" required disabled={!server.data.enabled} />
                  비활성화하면 기존 사용자의 연결이 중단될 수 있음을 확인합니다.
                </label>
                <button
                  className="button button--danger"
                  type="submit"
                  disabled={!server.data.enabled}
                >
                  <PowerIcon />서버 비활성화
                </button>
              </form>
            </div>
          </div>
        </Surface>
      </div>
      <ServerMarketCurationForm server={server.data} />
      <section>
        <SectionHeader
            title="서버 버전"
          description="읽기 전용 릴리스 상태입니다."
        />
        {versions.ok && activeVersion ? (
          <div className="grid">
            <ActiveVersionSummary version={activeVersion} />
            <ServerVersionTable versions={versionItems} />
          </div>
        ) : versions.ok ? (
          <EmptyState
             title="서버 버전이 없습니다"
             description="등록된 버전 정보가 없습니다."
          />
        ) : (
          <ErrorState title="서버 버전 사용 불가" message={versions.error} />
        )}
      </section>
      <section>
        <SectionHeader
          title="최근 감사 이벤트"
          description="이 서버의 가장 최근 감사 이벤트입니다."
        />
        {audit.ok && recentAudit.length > 0 ? (
          <AuditTable events={recentAudit} />
        ) : audit.ok ? (
          <EmptyState
            title="서버 감사 이벤트 없음"
            description="가져온 범위에 이 서버를 참조하는 감사 이벤트가 없습니다."
          />
        ) : (
          <ErrorState message={audit.error} />
        )}
      </section>
      {!grants.ok ? (
        <ErrorState title="권한 상태 사용 불가" message={grants.error} />
      ) : null}
      <section className="capability-section">
        <SectionHeader
          title="도구 관리"
          description="도구 스키마, 권한 상태, 활성화 제어를 확인합니다."
        />
        <div className="grid capability-panels">
          <div id="server-tools">
            <Surface className="capability-panel">
              <SectionHeader
                 title="서버 도구"
                 description="등록된 도구와 운영 상태입니다."
              />
              {tools.ok && toolItems.length > 0 ? (
                <>
                  <ToolTable
                    tools={toolItems}
                    grantStatusByToolKey={grantStatusByToolKey}
                    showSchema
                    showAccess
                    actionSlot={ToolControls}
                    audience="admin-detail"
                  />
                  <div className="grid">
                    <ToolTestLab options={toolTestOptions} />
                  </div>
                </>
              ) : tools.ok ? (
                <EmptyState
                  title="등록된 도구가 없습니다"
                  description="도구를 등록하면 여기에 표시됩니다."
                />
              ) : (
                <ErrorState message={tools.error} />
              )}
            </Surface>
          </div>
        </div>
      </section>
    </div>
  );
}

function ActiveVersionSummary({
  version,
}: Readonly<{ version: ApiMcpServerVersion }>) {
  return (
    <Surface>
      <SectionHeader
        title="활성 버전"
        description="활성 상태 또는 사용 가능한 최신 대체 항목에서 선택한 현재 서버 버전입니다."
      />
      <div className="grid">
        <div className="actions">
          <StatusPill tone={activeVersionTone(version)}>
            {formatServerVersionStatus(version.status)}
          </StatusPill>
          <StatusPill>{version.version}</StatusPill>
        </div>
        <details className="schema-viewer">
          <summary>이미지와 해시 보기</summary>
          <div className="grid">
            <p><strong>이미지:</strong> {formatVersionImage(version)}</p>
            <p><strong>설정 해시:</strong> {version.configHash ?? "기록 없음"}</p>
            <p><strong>도구 스키마 해시:</strong> {version.toolSchemaHash ?? "기록 없음"}</p>
          </div>
        </details>
        <p>
          <strong>생성:</strong> {formatDate(version.createdAt)}
        </p>
        <p>
          <strong>활성화:</strong> {formatDate(version.activatedAt)}
        </p>
      </div>
    </Surface>
  );
}

function activeVersionTone(version: ApiMcpServerVersion): StatusTone {
  if (version.status === "active") {
    return "success";
  }

  if (version.status === "deprecated" || version.status === "rolled_back") {
    return "neutral";
  }

  return "warning";
}

function formatVersionImage(version: ApiMcpServerVersion) {
  if (version.imageRef) {
    return version.imageRef;
  }

  if (version.imageRepository && version.imageTag) {
    return `${version.imageRepository}:${version.imageTag}`;
  }

  return version.imageRepository ?? version.imageDigest ?? "이미지 기록 없음";
}

function ToolControls(tool: ApiMcpTool) {
  return (
    <div className="actions">
      <form action={enableToolAction}>
        <input type="hidden" name="serverId" value={tool.serverId} />
        <input type="hidden" name="toolId" value={tool.id} />
        <label className="danger-confirm">
          <input type="checkbox" required disabled={tool.enabled} />
          이 도구를 다시 노출합니다.
        </label>
        <button className="button button--compact" type="submit" disabled={tool.enabled}>
          <PowerIcon />활성화
        </button>
      </form>
      <form action={disableToolAction}>
        <input type="hidden" name="serverId" value={tool.serverId} />
        <input type="hidden" name="toolId" value={tool.id} />
        <label className="danger-confirm">
          <input type="checkbox" required disabled={!tool.enabled} />
          이 도구 호출을 중단합니다.
        </label>
        <button
          className="button button--danger button--compact"
          type="submit"
          disabled={!tool.enabled}
        >
          <PowerIcon />비활성화
        </button>
      </form>
    </div>
  );
}
