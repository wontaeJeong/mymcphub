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

type CatalogFilters = Record<string, string | string[] | undefined>;

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
  const hasActiveFilters = Object.values(filters).some((value) => Array.isArray(value) ? value.some(Boolean) : Boolean(value));

  return (
    <div className="page-stack">
      <PageHero eyebrow={mode === "user" ? "MCP Market" : "카탈로그 관리"} title={mode === "user" ? "필요한 MCP 서버를 찾으세요." : "서버 카탈로그를 관리하세요."} description={mode === "admin" ? "서버 메타데이터, 게시 상태, 검토 상태를 관리합니다." : "승인 상태와 운영 상태를 확인하고 클라이언트 설정까지 이어갑니다."} />
      <form className="form-card" action={mode === "admin" ? "/admin/servers" : "/user/catalog"}>
        <h2>{mode === "user" ? "서버 검색" : "카탈로그 검색"}</h2>
        <p>{mode === "user" ? "이름, 설명, 태그로 검색합니다." : "서버 목록과 게시 상태를 필터링합니다."}</p>
        <div className="filter-grid">
          <div className="field">
            <label htmlFor="catalogSearch">검색</label>
            <input id="catalogSearch" name="q" defaultValue={readFilter(filters, "q")} placeholder="이름, 설명, 태그" />
          </div>
          {mode === "user" ? <CatalogCategoryField filters={filters} /> : null}
          {mode === "user" ? <CatalogAccessField filters={filters} /> : null}
        </div>
        {mode === "user" ? (
          <details className="schema-viewer">
            <summary>상세 필터</summary>
            <div className="filter-grid">
              <CatalogTagField filters={filters} />
              <CatalogEnvironmentField filters={filters} />
              <CatalogTransportField filters={filters} />
              <CatalogRiskField filters={filters} />
              <CatalogHealthField filters={filters} />
              <CatalogEnabledField filters={filters} mode={mode} />
              <CatalogTrustField filters={filters} />
              <CatalogVisibilityField filters={filters} />
            </div>
          </details>
        ) : (
          <div className="filter-grid">
            <CatalogEnvironmentField filters={filters} />
            <CatalogTransportField filters={filters} />
            <CatalogRiskField filters={filters} />
            <CatalogHealthField filters={filters} />
            <CatalogEnabledField filters={filters} mode={mode} />
          </div>
        )}
        <div className="form-actions">
          <button className="button" type="submit">필터 적용</button>
          <a className="button button--ghost" href={mode === "admin" ? "/admin/servers" : "/user/catalog"}>초기화</a>
        </div>
      </form>
      {!health.ok ? <ErrorState title="상태 정보 사용 불가" message={health.error} /> : null}
      {mode === "user" && grants && !grants.ok ? <ErrorState title="권한 정보 사용 불가" message={grants.error} /> : null}
      {mode === "user" && servers.ok && marketSections && !hasActiveFilters ? <MarketSectionsView sections={marketSections} healthByServerId={healthByServerId} accessByServerId={accessByServerId} /> : null}
      <section>
        <SectionHeader title={mode === "user" ? "검색 결과" : "서버 관리 목록"} description={mode === "user" ? "서버 정보와 다음 작업을 확인하세요." : "게시 상태, 검토 상태, 소유 팀을 확인합니다."} />
        {servers.ok && filteredServers.length > 0 && mode === "user" ? (
          <div className="market-card-grid">
            {filteredServers.map((server) => (
              <ServerMarketCard key={server.id} server={server} health={healthByServerId.get(server.id)} accessible={isServerAccessible(server, accessByServerId)} />
            ))}
          </div>
        ) : servers.ok && filteredServers.length > 0 ? <ServerTable servers={filteredServers} healthByServerId={healthByServerId} serverBasePath={mode === "admin" ? "/admin/servers" : "/user/servers"} showMarketCuration={mode === "admin"} audience={mode === "admin" ? "admin-summary" : "user"} /> : servers.ok && serverItems.length > 0 ? <EmptyState title="일치하는 서버가 없습니다" description="필터를 조정해 다시 검색하세요." /> : servers.ok ? <EmptyState title="등록된 서버가 없습니다" description={mode === "user" ? "관리자에게 서버 등록을 요청하세요." : "서버를 등록한 뒤 게시 상태를 관리하세요."} /> : <ErrorState message={servers.error} />}
      </section>
      {mode === "admin" ? <ServerRegistrationForm /> : null}
    </div>
  );
}

function CatalogCategoryField({ filters }: Readonly<{ filters: CatalogFilters }>) {
  return (
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
  );
}

function CatalogAccessField({ filters }: Readonly<{ filters: CatalogFilters }>) {
  return (
    <div className="field">
      <label htmlFor="catalogAccess">접근 상태</label>
      <select id="catalogAccess" name="access" defaultValue={readFilter(filters, "access")}>
        <option value="">전체</option>
        <option value="accessible">접근 가능</option>
        <option value="request_required">권한 필요</option>
      </select>
    </div>
  );
}

function CatalogTagField({ filters }: Readonly<{ filters: CatalogFilters }>) {
  return (
    <div className="field">
      <label htmlFor="catalogTag">태그 검색</label>
      <input id="catalogTag" name="tag" defaultValue={readFilter(filters, "tag")} placeholder="예: docs, ci, database" />
    </div>
  );
}

function CatalogEnvironmentField({ filters }: Readonly<{ filters: CatalogFilters }>) {
  return (
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
  );
}

function CatalogTransportField({ filters }: Readonly<{ filters: CatalogFilters }>) {
  return (
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
  );
}

function CatalogRiskField({ filters }: Readonly<{ filters: CatalogFilters }>) {
  return (
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
  );
}

function CatalogHealthField({ filters }: Readonly<{ filters: CatalogFilters }>) {
  return (
    <div className="field">
      <label htmlFor="catalogHealth">상태</label>
      <select id="catalogHealth" name="health" defaultValue={readFilter(filters, "health")}>
        <option value="">전체</option>
        <option value="healthy">정상</option>
        <option value="degraded">저하</option>
        <option value="unhealthy">비정상</option>
        <option value="unavailable">상태 없음</option>
      </select>
    </div>
  );
}

function CatalogEnabledField({ filters, mode }: Readonly<{ filters: CatalogFilters; mode: "user" | "admin" }>) {
  return (
    <div className="field">
      <label htmlFor="catalogEnabled">활성 상태</label>
      <select id="catalogEnabled" name="enabled" defaultValue={readFilter(filters, "enabled")}>
        <option value="">{mode === "user" ? "기본(활성)" : "전체"}</option>
        <option value="enabled">활성</option>
        <option value="disabled">비활성</option>
      </select>
    </div>
  );
}

function CatalogTrustField({ filters }: Readonly<{ filters: CatalogFilters }>) {
  return (
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
  );
}

function CatalogVisibilityField({ filters }: Readonly<{ filters: CatalogFilters }>) {
  return (
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
  );
}

function MarketSectionsView({ sections, healthByServerId, accessByServerId }: Readonly<{
  sections: MarketSections;
  healthByServerId: ReadonlyMap<string, ApiServerHealth>;
  accessByServerId: ReadonlyMap<string, boolean>;
}>) {
  return (
    <div className="market-sections">
      <MarketSection title="검증된 서버" description="검토가 완료된 서버입니다." emptyTitle="검증된 서버가 없습니다" emptyDescription="검토가 끝난 서버가 여기에 표시됩니다." servers={sections.verified} healthByServerId={healthByServerId} accessByServerId={accessByServerId} />
      <MarketSection title="최근 추가된 서버" description="최근 등록되거나 게시된 서버입니다." emptyTitle="최근 추가된 서버가 없습니다" emptyDescription="등록된 서버가 생기면 여기에 표시됩니다." servers={sections.recent} healthByServerId={healthByServerId} accessByServerId={accessByServerId} />
      <MarketSection title="연결 가능한 서버" description="현재 권한으로 사용할 수 있는 서버입니다." emptyTitle="연결 가능한 서버가 없습니다" emptyDescription="필요한 서버가 있다면 접근을 요청하세요." servers={sections.accessible} healthByServerId={healthByServerId} accessByServerId={accessByServerId} />
      <MarketSection title="권한이 필요한 서버" description="접근 승인 후 사용할 수 있는 서버입니다." emptyTitle="권한이 필요한 서버가 없습니다" emptyDescription="현재 표시된 서버는 모두 연결 가능하거나 목록이 비어 있습니다." servers={sections.requestRequired} healthByServerId={healthByServerId} accessByServerId={accessByServerId} />
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
        <StatusPill tone={accessible ? "success" : "warning"}>{accessible ? "접근 가능" : "권한 필요"}</StatusPill>
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
        {accessible ? <Link className="button button--ghost" href={`/user/client-config?serverId=${encodeURIComponent(server.id)}`}>설정 생성</Link> : <Link className="button button--ghost" href={`/user/access?serverId=${encodeURIComponent(server.id)}&environment=${encodeURIComponent(server.environment)}`}>접근 요청</Link>}
      </div>
    </article>
  );
}
