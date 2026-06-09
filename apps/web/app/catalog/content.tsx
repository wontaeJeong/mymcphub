import { EmptyState } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ServerRegistrationForm } from "../../components/server-registration-form";
import { ErrorState } from "../../components/states";
import { ServerTable } from "../../components/tables";
import { listServerHealth, listServers } from "../../lib/api";
import { loadResult } from "../../lib/result";
import { matchesCatalogFilters, readFilter } from "./page-helpers";

type CatalogPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export async function CatalogPageContent({ searchParams, mode }: CatalogPageProps & Readonly<{ mode: "user" | "admin" }>) {
  const filters = await searchParams;
  const serversPromise = loadResult(listServers());
  const healthPromise = loadResult(listServerHealth());
  const [servers, health] = await Promise.all([serversPromise, healthPromise]);
  const healthByServerId = new Map((health.ok ? health.data.items : []).map((check) => [check.serverId, check]));
  const serverItems = servers.ok ? servers.data.items : [];
  const filteredServers = serverItems.filter((server) => matchesCatalogFilters(server, healthByServerId.get(server.id), filters));

  return (
    <div className="page-stack">
      <PageHero eyebrow="MCP 서버 카탈로그" title="신뢰할 서버를 빠르게 찾으세요." description={mode === "admin" ? "실시간 제어 플레인 카탈로그에서 MCP 서버의 마켓 메타데이터, 게시 상태, 검토 품질을 큐레이션합니다." : "관리자 전용 제어 없이 실시간 제어 플레인 카탈로그에서 MCP 서버를 탐색하고 필터링합니다."} />
      <form className="form-card" action={mode === "admin" ? "/admin/servers" : "/user/catalog"}>
        <h2>카탈로그 검색 및 필터</h2>
        <p>필터는 실제 /api/servers 데이터에 적용되며, 사용 가능한 경우 /api/server-health 상태가 함께 표시됩니다.</p>
        <div className="filter-grid">
          <div className="field">
            <label htmlFor="catalogSearch">검색</label>
            <input id="catalogSearch" name="q" defaultValue={readFilter(filters, "q")} placeholder="슬러그, 이름, 소유자, 설명" />
          </div>
          <div className="field">
            <label htmlFor="catalogEnvironment">환경</label>
            <select id="catalogEnvironment" name="environment" defaultValue={readFilter(filters, "environment")}>
              <option value="">전체</option>
              <option value="dev">개발</option>
              <option value="stg">스테이징</option>
              <option value="prod">운영</option>
              <option value="shared">공용</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="catalogTransport">전송 방식</label>
            <select id="catalogTransport" name="transport" defaultValue={readFilter(filters, "transport")}>
              <option value="">전체</option>
              <option value="streamable_http">스트리밍 HTTP</option>
              <option value="sse_legacy">레거시 SSE</option>
              <option value="stdio_adapter">stdio 어댑터</option>
              <option value="external">외부</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="catalogRisk">위험도</label>
            <select id="catalogRisk" name="risk" defaultValue={readFilter(filters, "risk")}>
              <option value="">전체</option>
              <option value="low">낮음</option>
              <option value="medium">중간</option>
              <option value="high">높음</option>
              <option value="critical">심각</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="catalogHealth">상태</label>
            <select id="catalogHealth" name="health" defaultValue={readFilter(filters, "health")}>
              <option value="">전체</option>
              <option value="healthy">정상</option>
              <option value="degraded">저하</option>
              <option value="unhealthy">비정상</option>
              <option value="unavailable">확인 불가</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="catalogEnabled">활성 상태</label>
            <select id="catalogEnabled" name="enabled" defaultValue={readFilter(filters, "enabled")}>
              <option value="">전체</option>
              <option value="enabled">활성</option>
              <option value="disabled">비활성</option>
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button className="button" type="submit">필터 적용</button>
          <a className="button button--ghost" href={mode === "admin" ? "/admin/servers" : "/user/catalog"}>초기화</a>
        </div>
      </form>
      {!health.ok ? <ErrorState title="상태 정보 사용 불가" message={health.error} /> : null}
      <section>
        <SectionHeader title={mode === "admin" ? "카탈로그 관리" : "카탈로그"} description={mode === "admin" ? "관리자 목록에는 카테고리, 태그, 신뢰 수준, 게시/격리 상태, 문서/설치 누락, 소유 팀, 상세/감사 링크가 포함됩니다." : "서버 목록에는 슬러그, 표시 이름, 소유 팀, 환경, 전송 방식, 위험도, 상태, 활성 여부가 포함됩니다."} />
        {servers.ok && filteredServers.length > 0 ? <ServerTable servers={filteredServers} healthByServerId={healthByServerId} serverBasePath={mode === "admin" ? "/admin/servers" : "/user/servers"} showMarketCuration={mode === "admin"} /> : servers.ok && serverItems.length > 0 ? <EmptyState title="일치하는 서버 없음" description="제어 플레인이 서버를 반환했지만 선택한 필터와 일치하는 항목이 없습니다." /> : servers.ok ? <EmptyState title="등록된 서버 없음" description="제어 플레인이 빈 카탈로그를 반환했습니다. UI는 시드 데이터를 주입하지 않습니다." /> : <ErrorState message={servers.error} />}
      </section>
      {mode === "admin" ? <ServerRegistrationForm /> : null}
    </div>
  );
}
