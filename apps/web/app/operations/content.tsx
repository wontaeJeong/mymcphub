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
        eyebrow="운영 상태"
        title="운영 상태"
        description="상태 이상, 정책 거부, 격리 및 비활성 서버를 확인합니다."
      />
      <div className="card-grid">
        <Surface>
          <SectionHeader title="상태 이상" />
          <p>{incidentCount}</p>
        </Surface>
        <Surface>
          <SectionHeader title="거부 호출" />
          <p>{deniedToolCalls}</p>
        </Surface>
        <Surface>
          <SectionHeader title="격리 서버" />
          <p>{serverItems.filter((server) => server.quarantined).length}</p>
        </Surface>
        <Surface>
          <SectionHeader title="비활성 서버" />
          <p>{serverItems.filter((server) => !server.enabled).length}</p>
        </Surface>
      </div>
      {versionErrors.length > 0 ? (
        <ErrorState
          title="롤아웃 정보를 일부 확인할 수 없습니다"
          message={`${versionErrors.length}개 서버의 버전 정보를 불러오지 못했습니다.`}
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
              <caption>정책 거부 사유와 조정 안내</caption>
              <thead>
                <tr>
                  <th scope="col">사유</th>
                  <th scope="col">수</th>
                  <th scope="col">정책 조정 안내</th>
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
            title="정책 거부 없음"
            description="현재 감사 범위에서 거부된 도구 호출이 없습니다."
          />
        ) : (
          <ErrorState message={denied.error} />
        )}
      </section>
      <section>
        <details className="schema-viewer">
        <summary>롤아웃 상태</summary>
        <SectionHeader
           title="롤아웃 상태"
          description="활성 버전, 롤아웃 최신성, 격리 상태를 함께 표시합니다."
        />
        {servers.ok && rolloutRows.length > 0 ? (
          <RolloutStatusTable rows={rolloutRows} serverBasePath="/admin/servers" />
        ) : servers.ok ? (
          <EmptyState
             title="롤아웃 상태가 없습니다"
             description="서버를 등록하면 롤아웃 상태가 표시됩니다."
          />
        ) : (
          <ErrorState message={servers.error} />
        )}
        </details>
      </section>
      <section>
        <details className="schema-viewer">
        <summary>사용량</summary>
        <SectionHeader
          title="사용량 집계"
          description={`일별 호출 ${totalToolCalls}건의 상위 집계입니다.`}
        />
        {usage.ok && usageItems.length > 0 ? (
          <div className="table-wrap">
            <table>
              <caption>일별 사용량 집계</caption>
              <thead>
                <tr>
                  <th scope="col">기간</th>
                  <th scope="col">서버</th>
                  <th scope="col">도구</th>
                  <th scope="col">호출</th>
                  <th scope="col">거부</th>
                  <th scope="col">p95</th>
                  <th scope="col">p99</th>
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
             title="사용량 데이터가 없습니다"
             description="도구 호출이 기록되면 사용량이 표시됩니다."
          />
        ) : (
          <ErrorState message={usage.error} />
        )}
        </details>
      </section>
      <section>
        <SectionHeader
          title="서버 상태"
          description="최근 상태 확인 결과입니다."
        />
        {health.ok && healthItems.length > 0 ? (
          <HealthTable checks={healthItems} serverNameById={serverNameById} />
        ) : health.ok ? (
          <EmptyState
            title="상태 확인 결과가 없습니다"
            description="아직 상태 확인 결과가 없습니다."
          />
        ) : (
          <ErrorState message={health.error} />
        )}
      </section>
      <section>
        <details className="schema-viewer">
        <summary>서버 목록</summary>
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
             description="등록된 서버가 없습니다."
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
