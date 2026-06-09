import Link from "next/link";
import { EmptyState, StatusPill } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import {
  enabledTone,
  formatEnabled,
  formatEnvironment,
  formatHealthStatus,
  formatMarketCategory,
  formatMarketTrustLevel,
  formatMarketVisibility,
  formatRiskLevel,
  formatTransport,
  healthTone,
  marketTrustTone,
  marketVisibilityTone,
  riskTone,
} from "../../components/format";
import { ServerRegistrationForm } from "../../components/server-registration-form";
import { ErrorState } from "../../components/states";
import { ServerTable } from "../../components/tables";
import { getCurrentSession } from "../../lib/auth/session";
import type { ApiMcpServer, ApiServerHealth } from "../../lib/api";
import { listGrants, listServerHealth, listServers } from "../../lib/api";
import { loadResult } from "../../lib/result";
import {
  buildMarketSections,
  buildServerAccessMap,
  getMarketCategory,
  getMarketSummary,
  getMarketTags,
  getMarketTrustLevel,
  getMarketVisibility,
  isServerAccessible,
  matchesCatalogFilters,
  readFilter,
} from "./page-helpers";
import type { MarketSections } from "./page-helpers";

type CatalogPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export async function CatalogPageContent({ searchParams, mode }: CatalogPageProps & Readonly<{ mode: "user" | "admin" }>) {
  const filters = await searchParams;
  const serversPromise = loadResult(listServers());
  const healthPromise = loadResult(listServerHealth());
  const grantsPromise = mode === "user" ? loadResult(listGrants()) : Promise.resolve(undefined);
  const sessionPromise = mode === "user" ? getCurrentSession() : Promise.resolve(undefined);
  const [servers, health, grants, session] = await Promise.all([serversPromise, healthPromise, grantsPromise, sessionPromise]);
  const healthByServerId = new Map((health.ok ? health.data.items : []).map((check) => [check.serverId, check]));
  const serverItems = servers.ok ? servers.data.items : [];
  const grantItems = grants?.ok ? grants.data.items : [];
  const accessByServerId = mode === "user"
    ? buildServerAccessMap(serverItems, grantItems, session?.principal)
    : new Map<string, boolean>();
  const catalogFilterOptions = mode === "user"
    ? { accessByServerId, defaultEnabledOnly: true, defaultVisibleOnly: true }
    : {};
  const filteredServers = serverItems.filter((server) => matchesCatalogFilters(server, healthByServerId.get(server.id), filters, catalogFilterOptions));
  const marketSections = mode === "user" ? buildMarketSections(serverItems, accessByServerId) : undefined;

  return (
    <div className="page-stack">
      <PageHero eyebrow={mode === "user" ? "MCP Market" : "MCP 서버 카탈로그"} title={mode === "user" ? "내부 MCP 서버를 발견하고 연결하세요." : "신뢰할 서버를 빠르게 찾으세요."} description={mode === "admin" ? "실시간 제어 플레인 카탈로그에서 MCP 서버의 마켓 메타데이터, 게시 상태, 검토 품질을 큐레이션합니다." : "검증 상태, 접근 가능 여부, 운영 상태를 함께 보며 필요한 MCP 서버를 찾습니다. 광고, 랭킹, skills 없이 내부 운영 목적의 탐색만 제공합니다."} />
      <form className="form-card" action={mode === "admin" ? "/admin/servers" : "/user/catalog"}>
        <h2>{mode === "user" ? "MCP Market 검색 및 필터" : "카탈로그 검색 및 필터"}</h2>
        <p>필터는 실제 /api/servers 데이터에 적용되며, 사용 가능한 경우 /api/server-health 상태와 현재 세션 권한이 함께 표시됩니다.</p>
        <div className="filter-grid">
          <div className="field">
            <label htmlFor="catalogSearch">검색</label>
            <input id="catalogSearch" name="q" defaultValue={readFilter(filters, "q")} placeholder="슬러그, 이름, 소유자, 설명, 태그" />
          </div>
          {mode === "user" ? (
            <>
              <div className="field">
                <label htmlFor="catalogCategory">카테고리</label>
                <select id="catalogCategory" name="category" defaultValue={readFilter(filters, "category")}>
                  <option value="">전체</option>
                  <option value="developer_tools">개발 도구</option>
                  <option value="api_development">API 개발</option>
                  <option value="data_database">데이터·DB</option>
                  <option value="cloud_infra">클라우드·인프라</option>
                  <option value="observability">관측성</option>
                  <option value="security_testing">보안·테스트</option>
                  <option value="knowledge_docs">지식·문서</option>
                  <option value="productivity_workflow">생산성·워크플로</option>
                  <option value="browser_automation">브라우저 자동화</option>
                  <option value="design_tools">디자인 도구</option>
                  <option value="other">기타</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="catalogTag">태그 검색</label>
                <input id="catalogTag" name="tag" defaultValue={readFilter(filters, "tag")} placeholder="예: docs, ci, database" />
              </div>
            </>
          ) : null}
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
              <option value="">{mode === "user" ? "기본(활성)" : "전체"}</option>
              <option value="enabled">활성</option>
              <option value="disabled">비활성</option>
            </select>
          </div>
          {mode === "user" ? (
            <>
              <div className="field">
                <label htmlFor="catalogTrust">신뢰 수준</label>
                <select id="catalogTrust" name="trust" defaultValue={readFilter(filters, "trust")}>
                  <option value="">전체</option>
                  <option value="verified_only">검증된 항목만</option>
                  <option value="community">커뮤니티</option>
                  <option value="verified">검증됨</option>
                  <option value="official">공식</option>
                  <option value="platform_supported">플랫폼 지원</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="catalogAccess">접근 상태</label>
                <select id="catalogAccess" name="access" defaultValue={readFilter(filters, "access")}>
                  <option value="">전체</option>
                  <option value="accessible">접근 가능</option>
                  <option value="request_required">접근 요청 필요</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="catalogVisibility">게시/노출</label>
                <select id="catalogVisibility" name="visibility" defaultValue={readFilter(filters, "visibility")}>
                  <option value="">기본 노출</option>
                  <option value="all">전체 보기</option>
                  <option value="published">게시됨</option>
                  <option value="internal">내부 공개</option>
                  <option value="draft">초안</option>
                  <option value="hidden">숨김</option>
                  <option value="quarantined">격리됨</option>
                </select>
              </div>
            </>
          ) : null}
        </div>
        <div className="form-actions">
          <button className="button" type="submit">필터 적용</button>
          <a className="button button--ghost" href={mode === "admin" ? "/admin/servers" : "/user/catalog"}>초기화</a>
        </div>
      </form>
      {!health.ok ? <ErrorState title="상태 정보 사용 불가" message={health.error} /> : null}
      {mode === "user" && grants && !grants.ok ? <ErrorState title="권한 정보 사용 불가" message={grants.error} /> : null}
      {mode === "user" && servers.ok && marketSections ? <MarketSectionsView sections={marketSections} healthByServerId={healthByServerId} accessByServerId={accessByServerId} /> : null}
      <section>
        <SectionHeader title={mode === "user" ? "MCP Market 결과" : "카탈로그 관리"} description={mode === "user" ? "카드는 요약, 카테고리, 태그, 신뢰 수준, 접근 상태, 운영 상태와 다음 행동을 함께 보여줍니다." : "관리자 목록에는 카테고리, 태그, 신뢰 수준, 게시/격리 상태, 문서/설치 누락, 소유 팀, 상세/감사 링크가 포함됩니다."} />
        {servers.ok && filteredServers.length > 0 && mode === "user" ? (
          <div className="market-card-grid">
            {filteredServers.map((server) => (
              <ServerMarketCard key={server.id} server={server} health={healthByServerId.get(server.id)} accessible={isServerAccessible(server, accessByServerId)} />
            ))}
          </div>
        ) : servers.ok && filteredServers.length > 0 ? <ServerTable servers={filteredServers} healthByServerId={healthByServerId} serverBasePath={mode === "admin" ? "/admin/servers" : "/user/servers"} showMarketCuration={mode === "admin"} audience={mode === "admin" ? "admin-summary" : "user"} /> : servers.ok && serverItems.length > 0 ? <EmptyState title="일치하는 서버 없음" description="제어 플레인이 서버를 반환했지만 선택한 필터와 일치하는 항목이 없습니다." /> : servers.ok ? <EmptyState title="등록된 서버 없음" description="제어 플레인이 빈 카탈로그를 반환했습니다. UI는 시드 데이터를 주입하지 않습니다." /> : <ErrorState message={servers.error} />}
      </section>
      {mode === "admin" ? <ServerRegistrationForm /> : null}
    </div>
  );
}

function MarketSectionsView({ sections, healthByServerId, accessByServerId }: Readonly<{
  sections: MarketSections;
  healthByServerId: ReadonlyMap<string, ApiServerHealth>;
  accessByServerId: ReadonlyMap<string, boolean>;
}>) {
  return (
    <div className="market-sections">
      <MarketSection title="검증된 MCP 서버" description="검증됨, 공식, 플랫폼 지원 신뢰 수준의 내부 MCP 서버입니다." emptyTitle="검증된 서버 없음" emptyDescription="아직 검증 신뢰 수준이 부여된 서버가 없습니다." servers={sections.verified} healthByServerId={healthByServerId} accessByServerId={accessByServerId} />
      <MarketSection title="최근 게시됨" description="게시 시각 또는 생성 시각 기준의 최신 서버입니다. 인기나 순위가 아닙니다." emptyTitle="최근 게시된 서버 없음" emptyDescription="기본 노출 대상 서버가 아직 없습니다." servers={sections.recent} healthByServerId={healthByServerId} accessByServerId={accessByServerId} />
      <MarketSection title="내가 접근 가능한 서버" description="현재 Web 세션의 사용자·팀 권한과 일치하는 서버입니다." emptyTitle="접근 가능한 서버 없음" emptyDescription="필요한 서버가 있다면 접근 요청을 제출하세요." servers={sections.accessible} healthByServerId={healthByServerId} accessByServerId={accessByServerId} />
      <MarketSection title="접근 요청 필요" description="활성·게시된 서버 중 현재 세션 권한이 확인되지 않은 서버입니다." emptyTitle="요청이 필요한 서버 없음" emptyDescription="현재 기본 노출 대상 서버는 모두 접근 가능하거나 카탈로그가 비어 있습니다." servers={sections.requestRequired} healthByServerId={healthByServerId} accessByServerId={accessByServerId} />
    </div>
  );
}

function MarketSection({ title, description, emptyTitle, emptyDescription, servers, healthByServerId, accessByServerId }: Readonly<{
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  servers: ApiMcpServer[];
  healthByServerId: ReadonlyMap<string, ApiServerHealth>;
  accessByServerId: ReadonlyMap<string, boolean>;
}>) {
  return (
    <section>
      <SectionHeader title={title} description={description} />
      {servers.length > 0 ? (
        <div className="market-card-grid market-card-grid--compact">
          {servers.slice(0, 3).map((server) => (
            <ServerMarketCard key={server.id} server={server} health={healthByServerId.get(server.id)} accessible={isServerAccessible(server, accessByServerId)} />
          ))}
        </div>
      ) : <EmptyState title={emptyTitle} description={emptyDescription} />}
    </section>
  );
}

function ServerMarketCard({ server, health, accessible }: Readonly<{
  server: ApiMcpServer;
  health: ApiServerHealth | undefined;
  accessible: boolean;
}>) {
  const category = getMarketCategory(server);
  const tags = getMarketTags(server);
  const trustLevel = getMarketTrustLevel(server);
  const visibility = getMarketVisibility(server);

  return (
    <article className="market-card">
      <div className="market-card__header">
        <div>
          <p className="eyebrow">{formatMarketCategory(category)}</p>
          <h3>{server.displayName}</h3>
          <p className="market-card__slug">{server.slug}</p>
        </div>
        <StatusPill tone={marketTrustTone(trustLevel)}>{formatMarketTrustLevel(trustLevel)}</StatusPill>
      </div>
      <p>{getMarketSummary(server)}</p>
      <div className="actions" aria-label={`${server.displayName} 상태 배지`}>
        <StatusPill tone={accessible ? "success" : "warning"}>{accessible ? "접근 가능" : "접근 요청 필요"}</StatusPill>
        <StatusPill tone={marketVisibilityTone(visibility)}>{formatMarketVisibility(visibility)}</StatusPill>
        <StatusPill tone={enabledTone(server.enabled)}>{formatEnabled(server.enabled)}</StatusPill>
        <StatusPill tone={riskTone(server.riskLevel)}>{formatRiskLevel(server.riskLevel)}</StatusPill>
        <StatusPill tone={health ? healthTone(health.status) : "neutral"}>{formatHealthStatus(health?.status ?? "unavailable")}</StatusPill>
      </div>
      <div className="market-card__meta">
        <span>{formatEnvironment(server.environment)}</span>
        <span>{formatTransport(server.transport)}</span>
      </div>
      {tags.length > 0 ? (
        <div className="tag-list" aria-label={`${server.displayName} 태그`}>
          {tags.map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}
        </div>
      ) : <p className="muted">태그 없음</p>}
      <div className="market-card__actions">
        <Link className="button" href={`/user/servers/${server.id}`}>상세 보기</Link>
        {accessible ? <Link className="button button--ghost" href="/user/client-config">설정 생성</Link> : <Link className="button button--ghost" href="/user/access">접근 요청</Link>}
        {!accessible ? <Link className="button button--ghost" href="/user/client-config">설정 생성</Link> : null}
      </div>
    </article>
  );
}
