import { EmptyState, Surface } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { HealthTable, RolloutStatusTable, ServerTable } from "../../components/tables";
import {
  listDeniedCallAnalytics,
  listServerHealth,
  listServers,
  listServerVersions,
  listUsageReport,
} from "../../lib/api";
import { loadResult } from "../../lib/result";
import { buildRolloutStatusRows } from "./page-helpers";

export async function OperationsPageContent() {
  const serversPromise = loadResult(listServers());
  const healthPromise = loadResult(listServerHealth());
  const usagePromise = loadResult(listUsageReport("daily"));
  const deniedPromise = loadResult(listDeniedCallAnalytics());
  const [servers, health, usage, denied] = await Promise.all([
    serversPromise,
    healthPromise,
    usagePromise,
    deniedPromise,
  ]);
  const serverItems = servers.ok ? servers.data.items : [];
  const healthItems = health.ok ? health.data.items : [];
  const usageItems = usage.ok ? usage.data.items : [];
  const deniedReasons = denied.ok ? denied.data.byReason : [];
  const serverNameById = new Map(
    serverItems.map((server) => [server.id, server.displayName]),
  );
  const healthByServerId = new Map(
    healthItems.map((check) => [check.serverId, check]),
  );
  const versionResults = await Promise.all(
    serverItems.map(async (server) => ({
      server,
      versions: await loadResult(listServerVersions(server.id)),
    })),
  );
  const versionsByServerId = new Map(
    versionResults.map(({ server, versions }) => [
      server.id,
      versions.ok ? versions.data.items : [],
    ]),
  );
  const versionErrors = versionResults.filter((result) => !result.versions.ok);
  const rolloutRows = buildRolloutStatusRows(
    serverItems,
    versionsByServerId,
    healthByServerId,
  );
  const incidentCount = healthItems.filter(
    (check) => check.status !== "healthy",
  ).length;
  const totalToolCalls = usageItems.reduce((sum, item) => sum + item.calls, 0);
  const deniedToolCalls = denied.ok ? denied.data.totalDenied : 0;
  const displayedUsageItems = [...usageItems]
    .sort(
      (a, b) =>
        b.period.localeCompare(a.period) ||
        b.calls - a.calls ||
        usageItemKey(a).localeCompare(usageItemKey(b)),
    )
      .slice(0, 10);

  return (
    <div className="page-stack">
      <PageHero
        eyebrow="상태 및 운영"
        title="인시던트 신호를 먼저 보세요."
        description="상태 이상, 거부 호출, 격리, 비활성 서버를 먼저 확인하고 상세 표는 필요할 때 펼칩니다."
      />
      <div className="card-grid">
        <Surface>
          <SectionHeader title="장애" />
          <p>{incidentCount}</p>
        </Surface>
        <Surface>
          <SectionHeader title="거부 호출" />
          <p>{deniedToolCalls}</p>
        </Surface>
        <Surface>
          <SectionHeader title="격리됨" />
          <p>{serverItems.filter((server) => server.quarantined).length}</p>
        </Surface>
        <Surface>
          <SectionHeader title="비활성 서버" />
          <p>{serverItems.filter((server) => !server.enabled).length}</p>
        </Surface>
      </div>
      {versionErrors.length > 0 ? (
        <ErrorState
          title="롤아웃 버전을 일부 사용할 수 없음"
          message={`${versionErrors.length}개 서버 버전 요청이 롤아웃 상태를 구성하는 동안 실패했습니다.`}
        />
      ) : null}
      <section>
        <SectionHeader
          title="거부 호출 분석"
          description="정책 거부 사유와 조정 안내입니다."
        />
        {denied.ok && deniedReasons.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>사유</th>
                  <th>수</th>
                  <th>정책 조정 안내</th>
                </tr>
              </thead>
              <tbody>
                {deniedReasons.map((reason) => {
                  const tuning = denied.data.policyTuning.find(
                    (item) => item.reason === reason.reason,
                  );
                  return (
                    <tr key={reason.reason}>
                      <td>{reason.reason}</td>
                      <td>{reason.count}</td>
                      <td>
                        {tuning?.message ??
                          "조정 전에 권한과 정책을 검토하세요."}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : denied.ok ? (
          <EmptyState
            title="거부 호출 없음"
            description="현재 감사 범위에서 거부된 도구 호출이 없습니다."
          />
        ) : (
          <ErrorState message={denied.error} />
        )}
      </section>
      <section>
        <details className="schema-viewer">
        <summary>롤아웃 및 격리 상태 보기</summary>
        <SectionHeader
          title="롤아웃 및 격리 상태"
          description="활성 버전, 롤아웃 최신성, 격리 상태를 함께 표시합니다."
        />
        {servers.ok && rolloutRows.length > 0 ? (
          <RolloutStatusTable rows={rolloutRows} serverBasePath="/admin/servers" />
        ) : servers.ok ? (
          <EmptyState
            title="롤아웃 행 없음"
            description="롤아웃 상태를 표시하려면 먼저 서버를 등록하세요."
          />
        ) : (
          <ErrorState message={servers.error} />
        )}
        </details>
      </section>
      <section>
        <details className="schema-viewer">
        <summary>사용량 집계 보기</summary>
        <SectionHeader
          title="사용량 집계"
          description={`일별 호출 ${totalToolCalls}건의 상위 집계입니다.`}
        />
        {usage.ok && usageItems.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>기간</th>
                  <th>서버</th>
                  <th>도구</th>
                  <th>호출</th>
                  <th>거부</th>
                  <th>p95</th>
                  <th>p99</th>
                </tr>
              </thead>
              <tbody>
                {displayedUsageItems.map((item) => (
                  <tr key={usageItemKey(item)}>
                    <td>{item.period}</td>
                    <td>
                      {serverNameById.get(item.serverId ?? "") ??
                        item.serverId ??
                        "허브"}
                    </td>
                    <td>{item.toolName ?? "전체 도구"}</td>
                    <td>{item.calls}</td>
                    <td>{item.denied}</td>
                    <td>{item.p95LatencyMs} ms</td>
                    <td>{item.p99LatencyMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : usage.ok ? (
          <EmptyState
            title="사용량 행 없음"
            description="Gateway 트래픽이 기록되면 도구 호출 감사 이벤트가 여기에 표시됩니다."
          />
        ) : (
          <ErrorState message={usage.error} />
        )}
        </details>
      </section>
      <section>
        <SectionHeader
          title="서버 상태"
          description="상태 워커가 반환한 최신 상태입니다."
        />
        {health.ok && healthItems.length > 0 ? (
          <HealthTable checks={healthItems} serverNameById={serverNameById} />
        ) : health.ok ? (
          <EmptyState
            title="상태 확인 없음"
            description="제어 플레인이 상태 확인을 반환하지 않았습니다."
          />
        ) : (
          <ErrorState message={health.error} />
        )}
      </section>
      <section>
        <details className="schema-viewer">
        <summary>운영 카탈로그 표 보기</summary>
        <SectionHeader
          title="운영 카탈로그 상태"
          description="서버 활성 여부와 위험 수준의 전체 표입니다."
        />
        {servers.ok && serverItems.length > 0 ? (
          <ServerTable
            servers={serverItems}
            healthByServerId={healthByServerId}
            serverBasePath="/admin/servers"
            audience="admin-summary"
          />
        ) : servers.ok ? (
          <EmptyState
            title="서버 없음"
            description="제어 플레인이 카탈로그 항목을 반환하지 않았습니다."
          />
        ) : (
          <ErrorState message={servers.error} />
        )}
        </details>
      </section>
    </div>
  );
}

function usageItemKey(item: {
  period: string;
  teamId?: string;
  projectId?: string;
  userId?: string;
  clientId?: string;
  serverId?: string;
  toolName?: string;
}) {
  return [
    item.period,
    item.teamId ?? "team",
    item.projectId ?? "project",
    item.userId ?? "user",
    item.clientId ?? "client",
    item.serverId ?? "server",
    item.toolName ?? "tool",
  ].join(":");
}
