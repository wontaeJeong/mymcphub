import Link from "next/link";
import { EmptyState } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { AuditTable, ToolCallTable } from "../../components/tables";
import { buildAuditExportPath, getApiBaseUrl, listAuditEvents, listServers, listToolCallEvents } from "../../lib/api";
import { loadResult } from "../../lib/result";
import { advancedAuditFilterFields, buildAuditPageHref, commonAuditFilterFields, filterToolCallEvents, readAuditOptions, readFilter } from "./page-helpers";

type AuditPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export async function AuditPageContent({ searchParams }: AuditPageProps) {
  const filters = await searchParams;
  const auditOptions = readAuditOptions(filters);
  const auditPromise = loadResult(listAuditEvents(auditOptions));
  const callsPromise = loadResult(listToolCallEvents());
  const serversPromise = loadResult(listServers());
  const [audit, calls, servers] = await Promise.all([auditPromise, callsPromise, serversPromise]);
  const serverNameById = new Map((servers.ok ? servers.data.items : []).map((server) => [server.id, server.displayName]));
  const auditItems = audit.ok ? audit.data.items : [];
  const filteredCalls = calls.ok ? filterToolCallEvents(calls.data.items, filters) : [];
  const nextAuditHref = audit.ok && audit.data.pageInfo?.nextCursor ? buildAuditPageHref(filters, audit.data.pageInfo.nextCursor, "/admin/audit") : undefined;
  const exportHref = new URL(buildAuditExportPath(auditOptions), getApiBaseUrl()).toString();

  return (
    <div className="page-stack">
      <PageHero eyebrow="감사 로그" title="접근을 결정한 흐름을 추적하세요." description="정책 결정과 도구 호출 흐름을 먼저 보고, 추적 ID와 마스킹된 페이로드는 필요할 때 펼쳐 확인합니다." />
      <form className="form-card" action="/admin/audit">
        <h2>감사 필터</h2>
        <p>기간, 행위 유형, 정책 결정처럼 자주 쓰는 조건만 먼저 표시합니다.</p>
        <div className="filter-grid">
          {commonAuditFilterFields.map((field) => (
            <div className="field" key={field.name}>
              <label htmlFor={`filter-${field.name}`}>{field.label}</label>
              <input id={`filter-${field.name}`} name={field.name} defaultValue={field.name === "limit" ? readFilter(filters, field.name) || "100" : readFilter(filters, field.name)} placeholder={field.placeholder} />
            </div>
          ))}
        </div>
        <details className="schema-viewer">
          <summary>고급 진단 필터</summary>
          <div className="filter-grid">
            {advancedAuditFilterFields.map((field) => (
              <div className="field" key={field.name}>
                <label htmlFor={`filter-${field.name}`}>{field.label}</label>
                <input id={`filter-${field.name}`} name={field.name} defaultValue={readFilter(filters, field.name)} placeholder={field.placeholder} />
              </div>
            ))}
          </div>
        </details>
        <div className="form-actions">
          <button className="button" type="submit">필터 적용</button>
          <a className="button button--ghost" href="/admin/audit">초기화</a>
        </div>
      </form>
      <section>
        <SectionHeader title="정책 및 관리자 이벤트" description="정책 결정과 관리자 행위를 요약하고 추적·페이로드 진단은 행 안에서 펼칩니다." action={<div className="actions"><a className="button button--ghost" href={exportHref}>필터 결과 JSON 내보내기</a>{nextAuditHref ? <Link className="button" href={nextAuditHref}>다음 페이지</Link> : null}</div>} />
        {audit.ok && auditItems.length > 0 ? <AuditTable events={auditItems} /> : audit.ok ? <EmptyState title="감사 이벤트 없음" description="현재 서버 측 필터와 일치하는 감사 이벤트가 없습니다." /> : <ErrorState message={audit.error} />}
      </section>
      <section>
        <SectionHeader title="도구 호출 이벤트" description="운영 도구 실행 결과를 정책 감사와 분리해 확인합니다." />
        {calls.ok && filteredCalls.length > 0 ? <ToolCallTable events={filteredCalls} serverNameById={serverNameById} /> : calls.ok ? <EmptyState title="도구 호출 없음" description="현재 필터와 일치하는 도구 호출 이벤트가 없습니다." /> : <ErrorState message={calls.error} />}
      </section>
    </div>
  );
}
