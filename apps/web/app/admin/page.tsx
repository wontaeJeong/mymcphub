import Link from "next/link";
import { EmptyState, MetricCard, Surface } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { listApprovals, listAuditEvents, listServerHealth, listServers } from "../../lib/api";
import { summarizeMarketCuration } from "../../lib/market";
import { loadResult } from "../../lib/result";

export default async function AdminPage() {
  const [servers, approvals, audit, health] = await Promise.all([
    loadResult(listServers()),
    loadResult(listApprovals()),
    loadResult(listAuditEvents({ limit: 25 })),
    loadResult(listServerHealth()),
  ]);
  const serverItems = servers.ok ? servers.data.items : [];
  const pendingApprovals = approvals.ok ? approvals.data.items.filter((approval) => approval.status === "pending") : [];
  const deniedEvents = audit.ok ? audit.data.items.filter((event) => event.policyDecision === "deny") : [];
  const unhealthy = health.ok ? health.data.items.filter((item) => item.status !== "healthy") : [];
  const marketSummary = summarizeMarketCuration(serverItems);

  return (
    <div className="page-stack">
      <PageHero eyebrow="관리자 콘솔" title="명시적 권한으로 허브를 운영하세요." description="관리자 route는 사용자 셀프서비스와 분리되며, 렌더링 전에 플랫폼 관리자 역할 또는 그룹 매핑을 요구합니다." />
      <div className="card-grid">
        <Surface><SectionHeader title="서버" /><p>{serverItems.length}</p></Surface>
        <Surface><SectionHeader title="대기 중인 승인" /><p>{pendingApprovals.length}</p></Surface>
        <Surface><SectionHeader title="거부 이벤트" /><p>{deniedEvents.length}</p></Surface>
        <Surface><SectionHeader title="상태 인시던트" /><p>{unhealthy.length}</p></Surface>
      </div>
      <section>
        <SectionHeader title="마켓 카탈로그 상태" description="광고나 순위가 아니라 게시, 검토, 격리, 문서/설치 메타데이터 품질만 집계합니다." />
        <div className="metric-grid">
          <MetricCard label="게시된 서버" value={marketSummary.published} detail="visibility=published 또는 published=true" tone="success" />
          <MetricCard label="초안/내부 서버" value={marketSummary.draftInternal} detail="초안, 내부 공개, 숨김 상태" tone="info" />
          <MetricCard label="미검토 메타데이터" value={marketSummary.unreviewedMetadata} detail="reviewedBy/At 기록 없음" tone="warning" />
          <MetricCard label="격리된 서버" value={marketSummary.quarantined} detail="visibility=quarantined 또는 quarantined=true" tone={marketSummary.quarantined > 0 ? "danger" : "neutral"} />
          <MetricCard label="문서/설치 누락" value={marketSummary.missingDocsOrInstall} detail="docsUrl 또는 installMethods 누락" tone={marketSummary.missingDocsOrInstall > 0 ? "warning" : "success"} />
        </div>
      </section>
      {!servers.ok ? <ErrorState message={servers.error} /> : null}
      <section>
        <SectionHeader title="관리자 워크스페이스" description="서버 운영, 승인 판단, 감사 검토, 상태 운영, 긴급 제어는 사용자 워크스페이스와 분리됩니다." />
        <div className="card-grid">
          <AdminLink href="/admin/servers" title="카탈로그 관리" description="서버 등록, 마켓 메타데이터, 게시 상태, 검토 품질을 운영합니다." />
          <AdminLink href="/admin/approvals" title="승인 대기열" description="대기 중인 접근 요청을 승인하거나 거절합니다." />
          <AdminLink href="/admin/audit" title="감사 로그" description="감사 이벤트와 컴플라이언스 export를 검토합니다." />
          <AdminLink href="/admin/operations" title="운영 상태" description="상태, rollout, 사용량, 거부 호출 분석을 검토합니다." />
          <AdminLink href="/admin/emergency" title="긴급 제어" description="인시던트 중 거부 제어와 권한 회수를 수행합니다." />
          {serverItems.length === 0 ? <EmptyState title="서버 없음" description="관리자 서버 관리 페이지에서 서버를 등록하세요." /> : null}
        </div>
      </section>
    </div>
  );
}

function AdminLink({ href, title, description }: Readonly<{ href: string; title: string; description: string }>) {
  return <Link className="panel" href={href}><h2>{title}</h2><p>{description}</p></Link>;
}
