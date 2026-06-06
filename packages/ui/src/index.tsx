import type { ReactNode } from "react";

export type EmptyStateProps = Readonly<{
  title: string;
  description: string;
  action?: ReactNode;
}>;

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="ui-empty-state" aria-label={title}>
      <div className="ui-empty-state__mark" aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action ? <div className="ui-empty-state__action">{action}</div> : null}
    </section>
  );
}

export type SurfaceProps = Readonly<{
  children: ReactNode;
  className?: string;
}>;

export function Surface({ children, className }: SurfaceProps) {
  const classes = className ? `ui-surface ${className}` : "ui-surface";
  return <section className={classes}>{children}</section>;
}

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export type StatusPillProps = Readonly<{
  children: ReactNode;
  tone?: StatusTone;
}>;

export function StatusPill({ children, tone = "neutral" }: StatusPillProps) {
  return <span className={`ui-status-pill ui-status-pill--${tone}`}>{children}</span>;
}

export type MetricCardProps = Readonly<{
  label: string;
  value: string | number;
  detail?: string;
  tone?: StatusTone;
}>;

export function MetricCard({ label, value, detail, tone = "neutral" }: MetricCardProps) {
  return (
    <article className={`ui-metric-card ui-metric-card--${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      {detail ? <span>{detail}</span> : null}
    </article>
  );
}
