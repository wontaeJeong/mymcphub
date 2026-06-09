import Link from "next/link";
import { EmptyState, MetricCard } from "@mcp-hub/ui";

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
      <PageHero eyebrow="관리자 콘솔" title="오늘 처리할 운영 신호부터 확인하세요." description="승인, 상태 이상, 정책 거부, 격리처럼 즉시 판단할 항목을 먼저 보여줍니다." />
      <div className="metric-grid">
        <MetricCard label="대기 승인" value={pendingApprovals.length} detail="검토 카드 필요" tone={pendingApprovals.length > 0 ? "warning" : "success"} />
        <MetricCard label="상태 이상" value={unhealthy.length} detail="비정상·저하 상태" tone={unhealthy.length > 0 ? "danger" : "success"} />
        <MetricCard label="거부 이벤트" value={deniedEvents.length} detail="최근 감사 범위" tone={deniedEvents.length > 0 ? "warning" : "success"} />
        <MetricCard label="격리 서버" value={marketSummary.quarantined} detail="카탈로그/접근 차단" tone={marketSummary.quarantined > 0 ? "danger" : "success"} />
      </div>
      <section>
        <details className="schema-viewer">
          <summary>마켓 카탈로그 품질 보기</summary>
          <div className="metric-grid">
            <MetricCard label="게시된 서버" value={marketSummary.published} detail="게시 상태" tone="success" />
            <MetricCard label="초안/내부 서버" value={marketSummary.draftInternal} detail="아직 공개 검토 전" tone="info" />
            <MetricCard label="미검토 메타데이터" value={marketSummary.unreviewedMetadata} detail="검토 기록 필요" tone="warning" />
            <MetricCard label="문서/설치 누락" value={marketSummary.missingDocsOrInstall} detail="사용자 안내 보강 필요" tone={marketSummary.missingDocsOrInstall > 0 ? "warning" : "success"} />
          </div>
        </details>
      </section>
      {!servers.ok ? <ErrorState message={servers.error} /> : null}
      <section>
        <SectionHeader title="관리자 워크스페이스" description="서버 운영, 승인 판단, 감사 검토, 상태 운영, 긴급 제어는 사용자 워크스페이스와 분리됩니다." />
        <div className="card-grid">
          <AdminLink href="/admin/servers" title="서버" description="등록, 게시, 격리, 메타데이터 관리" />
          <AdminLink href="/admin/approvals" title="승인" description="접근 요청 검토와 결정" />
          <AdminLink href="/admin/audit" title="감사" description="정책 결정과 추적 진단" />
          <AdminLink href="/admin/operations" title="운영" description="상태, 거부, 롤아웃 점검" />
          <AdminLink href="/admin/emergency" title="긴급" description="거부 모드와 권한 회수" />
          {serverItems.length === 0 ? <EmptyState title="서버 없음" description="관리자 서버 관리 페이지에서 서버를 등록하세요." /> : null}
        </div>
      </section>
    </div>
  );
}

function AdminLink({ href, title, description }: Readonly<{ href: string; title: string; description: string }>) {
  return <Link className="panel" href={href}><h2>{title}</h2><p>{description}</p></Link>;
}
