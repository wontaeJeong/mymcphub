import { MetricCard } from "@mcp-hub/ui";

export type DashboardSummaryProps = Readonly<{
  registeredServers: number;
  enabledServers: number;
  disabledServers: number;
  highCriticalTools: number;
  recentDeniedCalls: number;
  recentFailedCalls: number;
  activeSessionStatus: string;
  activeSessionDetail: string;
}>;

export function DashboardSummary({
  registeredServers,
  enabledServers,
  disabledServers,
  highCriticalTools,
  recentDeniedCalls,
  recentFailedCalls,
  activeSessionStatus,
  activeSessionDetail
}: DashboardSummaryProps) {
  return (
    <section className="metric-grid" aria-label="MCP Hub 대시보드 요약">
      <MetricCard label="등록된 서버" value={registeredServers} detail="카탈로그 전체" tone="info" />
      <MetricCard label="활성 서버" value={enabledServers} detail="Gateway 사용 가능" tone={enabledServers > 0 ? "success" : "neutral"} />
      <MetricCard label="비활성 서버" value={disabledServers} detail="카탈로그에서 차단됨" tone={disabledServers > 0 ? "warning" : "success"} />
      <MetricCard label="높음 또는 심각 도구" value={highCriticalTools} detail="현재 도구 위험 수준" tone={highCriticalTools > 0 ? "danger" : "success"} />
      <MetricCard label="최근 거부된 호출" value={recentDeniedCalls} detail="거부된 감사 결정" tone={recentDeniedCalls > 0 ? "warning" : "success"} />
      <MetricCard label="최근 실패한 업스트림/도구 호출" value={recentFailedCalls} detail="실패 호출과 비정상 상태 확인" tone={recentFailedCalls > 0 ? "danger" : "success"} />
      <MetricCard label="활성 세션" value={activeSessionStatus} detail={activeSessionDetail} tone="neutral" />
    </section>
  );
}
