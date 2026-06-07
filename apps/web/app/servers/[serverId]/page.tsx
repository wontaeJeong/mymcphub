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
import { ErrorState } from "../../../components/states";
import {
  AuditTable,
  ServerVersionTable,
  ToolTable,
} from "../../../components/tables";
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
import { buildGrantStatus } from "../../tools/page-helpers";
import {
  selectActiveServerVersion,
  selectRecentServerAuditEvents,
  selectServerHealth,
} from "./page-helpers";

type ServerDetailPageProps = Readonly<{
  params: Promise<{ serverId: string }>;
}>;

export default async function ServerDetailPage({ params }: ServerDetailPageProps) {
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
          title="서버를 사용할 수 없습니다."
          description="제어 플레인이 이 MCP 서버를 반환하지 못했습니다."
        />
        <ErrorState message={server.error} />
        <Link className="button" href="/catalog">
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
    grants.ok ? grants.data.items : [],
  );

  return (
    <div className="page-stack">
      <PageHero
        eyebrow={server.data.slug}
        title={server.data.displayName}
        description={server.data.description ?? "공개된 서버 설명이 없습니다."}
      />
      <div className="detail-grid">
        <Surface>
          <SectionHeader
            title="서버 프로필"
            description="이 MCP 서버의 제어 플레인 메타데이터입니다."
          />
          <div className="grid">
            <p>
              <strong>서버 ID:</strong> {server.data.id}
            </p>
            <p>
              <strong>소유 팀:</strong> {server.data.ownerTeamId}
            </p>
            <p>
              <strong>환경:</strong> {formatEnvironment(server.data.environment)}
            </p>
            <p>
              <strong>전송 방식:</strong> {formatTransport(server.data.transport)}
            </p>
            <p>
              <strong>업스트림 URL:</strong>{" "}
              {server.data.upstreamUrl ??
                "제어 플레인 API에서 확인할 수 없습니다"}
            </p>
            <p>
              <strong>스키마 버전:</strong>{" "}
              {server.data.schemaVersion ??
                "제어 플레인 API에서 확인할 수 없습니다"}
            </p>
            <p>
              <strong>생성:</strong> {formatDate(server.data.createdAt)}
            </p>
            <p>
              <strong>업데이트:</strong> {formatDate(server.data.updatedAt)}
            </p>
          </div>
        </Surface>
        <Surface className="panel--accent">
          <SectionHeader
            title="위험도 및 제어"
            description="기존 제어 플레인 엔드포인트로 이 서버를 활성화하거나 비활성화합니다."
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
                <StatusPill>상태 확인 불가</StatusPill>
              )}
            </div>
            {latestHealth ? (
              <p className="muted">
                최근 상태 확인: {formatDate(latestHealth.checkedAt)}
                {latestHealth.errorMessage ? ` · ${latestHealth.errorMessage}` : ""}
              </p>
            ) : (
              <p className="muted">
                이 서버에 대한 /api/server-health 행이 반환되지 않았습니다.
              </p>
            )}
            <div className="actions">
              <form action={enableServerAction}>
                <input type="hidden" name="serverId" value={server.data.id} />
                <button
                  className="button"
                  type="submit"
                  disabled={server.data.enabled}
                >
                  서버 활성화
                </button>
              </form>
              <form action={disableServerAction}>
                <input type="hidden" name="serverId" value={server.data.id} />
                <button
                  className="button button--danger"
                  type="submit"
                  disabled={!server.data.enabled}
                >
                  서버 비활성화
                </button>
              </form>
            </div>
          </div>
        </Surface>
      </div>
      <section>
        <SectionHeader
          title="서버 버전"
          description="/api/servers/:serverId/versions의 읽기 전용 릴리스 상태입니다."
        />
        {versions.ok && activeVersion ? (
          <div className="grid">
            <ActiveVersionSummary version={activeVersion} />
            <ServerVersionTable versions={versionItems} />
          </div>
        ) : versions.ok ? (
          <EmptyState
            title="서버 버전 없음"
            description="제어 플레인이 이 서버의 버전을 반환하지 않았습니다."
          />
        ) : (
          <ErrorState title="서버 버전 사용 불가" message={versions.error} />
        )}
      </section>
      <section>
        <SectionHeader
          title="최근 감사 이벤트"
          description="/api/audit-events에서 가져온 이 서버의 가장 최근 이벤트입니다."
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
          title="도구, 리소스, 프롬프트"
          description="제어 플레인 기능 탭은 실시간 도구 계약을 보여주고 Go API 엔드포인트가 아직 노출하지 않는 리소스와 프롬프트를 명시합니다."
        />
        <div className="capability-tabs" role="tablist" aria-label="서버 기능">
          <a
            className="capability-tab"
            href="#server-tools"
            role="tab"
            aria-selected="true"
          >
            도구
          </a>
          <a
            className="capability-tab"
            href="#server-resources"
            role="tab"
            aria-selected="false"
          >
            리소스
          </a>
          <a
            className="capability-tab"
            href="#server-prompts"
            role="tab"
            aria-selected="false"
          >
            프롬프트
          </a>
        </div>
        <div className="grid capability-panels">
          <div id="server-tools">
            <Surface className="capability-panel">
              <SectionHeader
                title="서버 도구"
                description="/api/servers/:serverId/tools로 발견한 도구, 스키마 표시, 권한 상태, 도구 활성화 제어입니다."
              />
              {tools.ok && toolItems.length > 0 ? (
                <ToolTable
                  tools={toolItems}
                  grantStatusByToolKey={grantStatusByToolKey}
                  showSchema
                  showAccess
                  actionSlot={ToolControls}
                />
              ) : tools.ok ? (
                <EmptyState
                  title="발견된 도구 없음"
                  description="서버는 존재하지만 제어 플레인이 도구를 반환하지 않았습니다."
                />
              ) : (
                <ErrorState message={tools.error} />
              )}
            </Surface>
          </div>
          <div id="server-resources">
            <Surface className="capability-panel">
              <SectionHeader
                title="리소스"
                description="Gateway initialize는 리소스 기능을 알리지만, 이 Go 제어 플레인 계약은 아직 /resources list/read 엔드포인트를 노출하지 않습니다."
              />
              <EmptyState
                title="리소스 엔드포인트가 노출되지 않음"
                description="목 데이터에서 리소스를 렌더링하지 않습니다. 리소스 행을 Web에 나열하기 전에 제어 플레인 리소스 계약을 추가하세요."
              />
            </Surface>
          </div>
          <div id="server-prompts">
            <Surface className="capability-panel">
              <SectionHeader
                title="프롬프트"
                description="Gateway initialize는 프롬프트 기능을 알리지만, 이 Go 제어 플레인 계약은 아직 /prompts list/get 엔드포인트를 노출하지 않습니다."
              />
              <EmptyState
                title="프롬프트 엔드포인트가 노출되지 않음"
                description="목 데이터에서 프롬프트를 렌더링하지 않습니다. 프롬프트 행을 Web에 나열하기 전에 제어 플레인 프롬프트 계약을 추가하세요."
              />
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
        <p>
          <strong>이미지:</strong> {formatVersionImage(version)}
        </p>
        <p>
          <strong>설정 해시:</strong> {version.configHash ?? "기록 없음"}
        </p>
        <p>
          <strong>도구 스키마 해시:</strong>{" "}
          {version.toolSchemaHash ?? "기록 없음"}
        </p>
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
        <button className="button" type="submit" disabled={tool.enabled}>
          활성화
        </button>
      </form>
      <form action={disableToolAction}>
        <input type="hidden" name="serverId" value={tool.serverId} />
        <input type="hidden" name="toolId" value={tool.id} />
        <button
          className="button button--danger"
          type="submit"
          disabled={!tool.enabled}
        >
          비활성화
        </button>
      </form>
    </div>
  );
}
