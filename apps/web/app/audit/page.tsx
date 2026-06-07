import Link from "next/link";
import { EmptyState } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { AuditTable, ToolCallTable } from "../../components/tables";
import { listAuditEvents, listServers, listToolCallEvents } from "../../lib/api";
import { loadResult } from "../../lib/result";
import { auditFilterFields, buildAuditPageHref, filterToolCallEvents, readAuditOptions, readFilter } from "./page-helpers";

type AuditPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const filters = await searchParams;
  const auditPromise = loadResult(listAuditEvents(readAuditOptions(filters)));
  const callsPromise = loadResult(listToolCallEvents());
  const serversPromise = loadResult(listServers());
  const [audit, calls, servers] = await Promise.all([auditPromise, callsPromise, serversPromise]);
  const serverNameById = new Map((servers.ok ? servers.data.items : []).map((server) => [server.id, server.displayName]));
  const auditItems = audit.ok ? audit.data.items : [];
  const filteredCalls = calls.ok ? filterToolCallEvents(calls.data.items, filters) : [];
  const nextAuditHref = audit.ok && audit.data.pageInfo?.nextCursor ? buildAuditPageHref(filters, audit.data.pageInfo.nextCursor) : undefined;

  return (
    <div className="page-stack">
      <PageHero eyebrow="감사 로그" title="접근을 결정한 흐름을 추적하세요." description="서버 측 감사 필터, 마스킹된 메타데이터, 추적 ID 복사 기능으로 제어 플레인 API의 감사 이벤트와 도구 호출 이벤트를 표시합니다." />
      <form className="form-card" action="/audit">
        <h2>감사 필터</h2>
        <p>감사 필터는 /api/audit-events로 전송됩니다. 도구 호출 상태는 /api/tool-call-events에 대한 Web 전용 필터로 유지됩니다.</p>
        <div className="filter-grid">
          {auditFilterFields.map((field) => (
            <div className="field" key={field.name}>
              <label htmlFor={`filter-${field.name}`}>{field.label}</label>
              <input id={`filter-${field.name}`} name={field.name} defaultValue={field.name === "limit" ? readFilter(filters, field.name) || "100" : readFilter(filters, field.name)} placeholder={field.placeholder} />
            </div>
          ))}
        </div>
        <div className="form-actions">
          <button className="button" type="submit">필터 적용</button>
          <a className="button button--ghost" href="/audit">초기화</a>
        </div>
      </form>
      <section>
        <SectionHeader title="정책 및 관리자 이벤트" description="서버 측 필터와 마스킹된 인자 세부 정보가 포함된 /api/audit-events 페이지 결과입니다." action={nextAuditHref ? <Link className="button" href={nextAuditHref}>다음 페이지</Link> : undefined} />
        {audit.ok && auditItems.length > 0 ? <AuditTable events={auditItems} /> : audit.ok ? <EmptyState title="감사 이벤트 없음" description="현재 서버 측 필터와 일치하는 감사 이벤트가 없습니다." /> : <ErrorState message={audit.error} />}
      </section>
      <section>
        <SectionHeader title="도구 호출 이벤트" description="/api/tool-call-events의 운영 도구 실행 기록입니다." />
        {calls.ok && filteredCalls.length > 0 ? <ToolCallTable events={filteredCalls} serverNameById={serverNameById} /> : calls.ok ? <EmptyState title="도구 호출 없음" description="현재 필터와 일치하는 도구 호출 이벤트가 없습니다." /> : <ErrorState message={calls.error} />}
      </section>
    </div>
  );
}
