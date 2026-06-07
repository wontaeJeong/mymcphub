import { MetricCard } from "@mcp-hub/ui";
import Link from "next/link";
import type { ReactNode } from "react";

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
      <MetricCard label="Registered servers" value={registeredServers} detail="Servers available to operators" tone="info" />
      <MetricCard label="Enabled servers" value={enabledServers} detail="Ready for gateway use" tone={enabledServers > 0 ? "success" : "neutral"} />
      <MetricCard label="Disabled servers" value={disabledServers} detail="Intentionally blocked from use" tone={disabledServers > 0 ? "warning" : "success"} />
      <MetricCard label="High or critical tools" value={highCriticalTools} detail="Live tool risk posture" tone={highCriticalTools > 0 ? "danger" : "success"} />
      <MetricCard label="Recent denied calls" value={recentDeniedCalls} detail="Denied audit decisions" tone={recentDeniedCalls > 0 ? "warning" : "success"} />
      <MetricCard label="Recent failed tool or health signals" value={recentFailedCalls} detail="Failed calls plus non-healthy checks" tone={recentFailedCalls > 0 ? "danger" : "success"} />
      <MetricCard label="Active sessions" value={activeSessionStatus} detail={activeSessionDetail} tone="neutral" />
    </section>
  );
}

export type AttentionItem = Readonly<{
  title: string;
  detail: string;
  href?: string;
  action?: string;
  tone?: "danger" | "warning" | "info" | "success";
}>;

export function NeedsAttention({ items }: Readonly<{ items: readonly AttentionItem[] }>) {
  const visibleItems = items.length > 0 ? items : [{ title: "No urgent operator action", detail: "Servers, access requests, denies, and health checks have no active attention item.", tone: "success" as const }];

  return (
    <section className="panel panel--accent" aria-labelledby="needs-attention-heading">
      <div className="section-header">
        <div>
          <p className="eyebrow">Priority</p>
          <h2 id="needs-attention-heading">Needs attention</h2>
          <p>Start here before scanning detailed tables.</p>
        </div>
      </div>
      <div className="attention-list">
        {visibleItems.map((item) => (
          <AttentionCard item={item} key={`${item.title}:${item.detail}`} />
        ))}
      </div>
    </section>
  );
}

export function FirstRunOnboarding({ admin = false }: Readonly<{ admin?: boolean }>) {
  return (
    <section className="onboarding-panel" aria-labelledby="onboarding-heading">
      <div>
        <p className="eyebrow">First run</p>
        <h2 id="onboarding-heading">Bring the first server online</h2>
        <p>No servers are registered yet. Follow the safe MVP path before generating client setup.</p>
      </div>
      <ol className="onboarding-steps">
        <OnboardingStep number="1" title="Register a server" detail="Add the server name, owner, environment, risk, and starter tool." href={admin ? "/admin/servers#register-server" : "/admin/servers#register-server"} action="Open Servers" />
        <OnboardingStep number="2" title="Review discovered tools" detail="Confirm tool names, risk levels, enablement, and schema visibility." href={admin ? "/admin/servers" : "/user/catalog"} action="Review tools" />
        <OnboardingStep number="3" title="Create or request access" detail="Make sure the right user, team, or service account has a scoped grant." href={admin ? "/admin/access" : "/user/access"} action="Open grants" />
        <OnboardingStep number="4" title="Generate client setup" detail="Create the profile snippet only after the server is enabled and access is clear." href="/user/client-config" action="Generate setup" />
      </ol>
    </section>
  );
}

function AttentionCard({ item }: Readonly<{ item: AttentionItem }>) {
  return (
    <article className={`attention-card attention-card--${item.tone ?? "info"}`}>
      <h3>{item.title}</h3>
      <p>{item.detail}</p>
      {item.href ? <Link className="button button--ghost" href={item.href}>{item.action ?? "Review"}</Link> : null}
    </article>
  );
}

function OnboardingStep({ number, title, detail, href, action }: Readonly<{ number: string; title: string; detail: string; href: string; action: ReactNode }>) {
  return (
    <li>
      <span className="onboarding-step__number">{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{detail}</p>
        <Link className="button button--ghost" href={href}>{action}</Link>
      </div>
    </li>
  );
}
