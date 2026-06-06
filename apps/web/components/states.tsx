import { EmptyState } from "@mcp-hub/ui";

export type ErrorStateProps = Readonly<{
  title?: string;
  message: string;
}>;

export function ErrorState({ title = "Control Plane unavailable", message }: ErrorStateProps) {
  return (
    <section className="error-state" role="status">
      <strong>{title}</strong>
      <p>{message}</p>
    </section>
  );
}

export type EmptyListProps = Readonly<{
  title: string;
  description: string;
}>;

export function EmptyList({ title, description }: EmptyListProps) {
  return <EmptyState title={title} description={description} />;
}

export function LoadingPanel() {
  return (
    <section className="loading-state" role="status">
      <strong>Loading MCP Hub operations...</strong>
      <p>Contacting the Control Plane API and preparing live operations state.</p>
    </section>
  );
}
