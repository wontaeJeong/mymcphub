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
    <section className="metric-grid" aria-label="MCP Hub dashboard summary">
      <MetricCard label="Registered servers" value={registeredServers} detail="Control Plane catalog count" tone="info" />
      <MetricCard label="Enabled servers" value={enabledServers} detail="Ready for gateway use" tone={enabledServers > 0 ? "success" : "neutral"} />
      <MetricCard label="Disabled servers" value={disabledServers} detail="Blocked at the catalog" tone={disabledServers > 0 ? "warning" : "success"} />
      <MetricCard label="High or critical tools" value={highCriticalTools} detail="Live tool risk posture" tone={highCriticalTools > 0 ? "danger" : "success"} />
      <MetricCard label="Recent denied calls" value={recentDeniedCalls} detail="Denied audit decisions" tone={recentDeniedCalls > 0 ? "warning" : "success"} />
      <MetricCard label="Recent failed upstream/tool calls" value={recentFailedCalls} detail="Failed calls plus non-healthy checks" tone={recentFailedCalls > 0 ? "danger" : "success"} />
      <MetricCard label="Active sessions" value={activeSessionStatus} detail={activeSessionDetail} tone="neutral" />
    </section>
  );
}
