import Link from "next/link";
import { EmptyState, StatusPill } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import {
  formatEnabled,
  formatEnvironment,
  formatHealthStatus,
  formatMarketCategory,
  formatMarketTrustLevel,
  formatMarketVisibility,
  formatRiskLevel,
  formatTransport,
  healthTone,
} from "../../components/format";
import { EyeIcon, FilterIcon, KeyIcon, SearchIcon, ServerIcon } from "../../components/icons";
import { ServerRegistrationForm } from "../../components/server-registration-form";
import { ErrorState } from "../../components/states";
import { ServerTable } from "../../components/tables";
import { getCurrentSession } from "../../lib/auth/session";
import type { ApiMcpServer, ApiServerHealth } from "../../lib/api";
import { listGrants, listServerHealth, listServers } from "../../lib/api";
import { loadResult } from "../../lib/result";
import {
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
  const hasActiveFilters = Object.values(filters).some((value) => Array.isArray(value) ? value.some(Boolean) : Boolean(value));

  return (
    <div className="page-stack">
      <PageHero eyebrow={mode === "user" ? "서버 찾기" : "카탈로그 관리"} title={mode === "user" ? "필요한 MCP 서버를 찾으세요." : "서버 카탈로그를 관리하세요."} description={mode === "admin" ? "서버 메타데이터, 게시 상태, 검토 상태를 관리합니다." : "승인 상태와 운영 상태를 확인하고 접근 요청까지 이어갑니다."} />
      <form className="form-card filter-card" action={mode === "admin" ? "/admin/servers" : "/user/catalog"}>
        <div className="form-card__heading">
          <div className="heading-icon"><SearchIcon /></div>
          <div>
            <h2>{mode === "user" ? "서버 검색" : "카탈로그 검색"}</h2>
            <p>{mode === "user" ? "이름, 설명, 태그로 검색합니다." : "서버 목록과 게시 상태를 필터링합니다."}</p>
          </div>
        </div>
        <div className="filter-grid">
          <div className="field">
            <label htmlFor="catalogSearch">검색</label>
            <div className="input-with-icon">
              <SearchIcon />
              <input id="catalogSearch" name="q" defaultValue={readFilter(filters, "q")} placeholder="이름, 설명, 태그" />
            </div>
          </div>
          {mode === "user" ? <CatalogCategoryField filters={filters} /> : null}
          {mode === "user" ? <CatalogAccessField filters={filters} /> : null}
        </div>
        {mode === "user" ? (
          <details className="schema-viewer disclosure--filters">
            <summary><FilterIcon />상세 필터</summary>
            <div className="filter-grid">
              <CatalogEnvironmentField filters={filters} />
              <CatalogTransportField filters={filters} />
              <CatalogRiskField filters={filters} />
              <CatalogHealthField filters={filters} />
              <CatalogTrustField filters={filters} />
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
          <button className="button" type="submit"><FilterIcon />필터 적용</button>
          <a className="button button--subtle" href={mode === "admin" ? "/admin/servers" : "/user/catalog"}>초기화</a>
          {hasActiveFilters ? <span className="filter-count" role="status">필터 적용 중</span> : null}
        </div>
      </form>
      {!health.ok ? <ErrorState title="상태 정보 사용 불가" message={health.error} /> : null}
      {mode === "user" && grants && !grants.ok ? <ErrorState title="권한 정보 사용 불가" message={grants.error} /> : null}
      <section>
        <SectionHeader title={mode === "user" ? (hasActiveFilters ? "검색 결과" : "서버 목록") : "서버 관리 목록"} description={mode === "user" ? "필요한 서버를 선택하고 접근 상태를 확인하세요." : "게시 상태, 검토 상태, 소유 팀을 확인합니다."} />
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
        <div className="heading-icon"><ServerIcon /></div>
        <div>
          <p className="eyebrow">{formatMarketCategory(category)}</p>
          <h3>{server.displayName}</h3>
        </div>
      </div>
      <p>{getMarketSummary(server)}</p>
      <div className="actions" aria-label={`${server.displayName} 상태 배지`}>
        <StatusPill tone={accessible ? "success" : "warning"}>{accessible ? "접근 가능" : "권한 필요"}</StatusPill>
        <StatusPill tone={health ? healthTone(health.status) : "neutral"}>{formatHealthStatus(health?.status ?? "unavailable")}</StatusPill>
      </div>
      {tags.length > 0 ? (
        <div className="tag-list" aria-label={`${server.displayName} 태그`}>
          {tags.map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}
        </div>
      ) : <p className="muted">태그 없음</p>}
      <details className="schema-viewer">
        <summary>세부 정보</summary>
        <div className="market-card__meta">
          <span>{server.slug}</span>
          <span>{formatEnvironment(server.environment)}</span>
          <span>{formatTransport(server.transport)}</span>
          <span>{formatRiskLevel(server.riskLevel)}</span>
          <span>{formatMarketTrustLevel(trustLevel)}</span>
          <span>{formatMarketVisibility(visibility)}</span>
          <span>{formatEnabled(server.enabled)}</span>
        </div>
      </details>
      <div className="market-card__actions">
        <Link className="button" href={`/user/servers/${server.id}`}><EyeIcon />상세 보기</Link>
        {!accessible ? <Link className="button button--ghost" href={`/user/access?serverId=${encodeURIComponent(server.id)}&environment=${encodeURIComponent(server.environment)}`}><KeyIcon />접근 요청</Link> : null}
      </div>
    </article>
  );
}
