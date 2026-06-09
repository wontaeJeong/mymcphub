import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState, MetricCard } from "@mcp-hub/ui";

import { PageHero, SectionHeader } from "../../components/chrome";
import { ActivityIcon, AlertTriangleIcon, DatabaseIcon, KeyIcon, ShieldIcon } from "../../components/icons";
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
      <PageHero eyebrow="관리자 콘솔" title="운영 현황" description="승인 요청, 상태 이상, 정책 거부, 격리 상태를 확인합니다." />
      <div className="metric-grid">
        <MetricCard label="대기 승인" value={pendingApprovals.length} detail="검토 필요" tone={pendingApprovals.length > 0 ? "warning" : "success"} />
        <MetricCard label="상태 이상" value={unhealthy.length} detail="비정상·저하 상태" tone={unhealthy.length > 0 ? "danger" : "success"} />
        <MetricCard label="거부 이벤트" value={deniedEvents.length} detail="최근 이벤트" tone={deniedEvents.length > 0 ? "warning" : "success"} />
        <MetricCard label="격리 서버" value={marketSummary.quarantined} detail="격리 중" tone={marketSummary.quarantined > 0 ? "danger" : "success"} />
      </div>
      <section>
        <details className="schema-viewer">
          <summary>카탈로그 품질</summary>
          <div className="metric-grid">
            <MetricCard label="게시된 서버" value={marketSummary.published} detail="게시 상태" tone="success" />
            <MetricCard label="초안/내부 서버" value={marketSummary.draftInternal} detail="검토 전" tone="info" />
            <MetricCard label="미검토 메타데이터" value={marketSummary.unreviewedMetadata} detail="검토 기록 필요" tone="warning" />
            <MetricCard label="문서/설치 누락" value={marketSummary.missingDocsOrInstall} detail="사용자 안내 보강 필요" tone={marketSummary.missingDocsOrInstall > 0 ? "warning" : "success"} />
          </div>
        </details>
      </section>
      {!servers.ok ? <ErrorState message={servers.error} /> : null}
      <section>
        <SectionHeader title="관리 작업" description="카탈로그, 승인 요청, 감사 이벤트, 운영 상태를 관리합니다." />
        <div className="card-grid">
          <AdminLink href="/admin/servers" title="카탈로그 관리" description="서버 등록, 게시, 격리" icon={<DatabaseIcon />} />
          <AdminLink href="/admin/approvals" title="승인 요청 검토" description="요청 사유와 도구 위험도 확인" icon={<ShieldIcon />} />
          <AdminLink href="/admin/audit" title="감사 이벤트" description="정책 결정과 추적 정보 확인" icon={<KeyIcon />} />
          <AdminLink href="/admin/operations" title="운영 상태" description="상태 이상과 정책 거부 확인" icon={<ActivityIcon />} />
          <AdminLink href="/admin/emergency" title="긴급 조치" description="전체 차단과 권한 회수" icon={<AlertTriangleIcon />} />
          {serverItems.length === 0 ? <EmptyState title="서버 없음" description="관리자 서버 관리 페이지에서 서버를 등록하세요." /> : null}
        </div>
      </section>
    </div>
  );
}

function AdminLink({ href, title, description, icon }: Readonly<{ href: string; title: string; description: string; icon: ReactNode }>) {
  return <Link className="panel action-card" href={href}><span className="heading-icon">{icon}</span><span><h2>{title}</h2><p>{description}</p></span></Link>;
}
