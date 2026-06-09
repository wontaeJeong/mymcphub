import { EmptyState } from "@mcp-hub/ui";

export type ErrorStateProps = Readonly<{
  title?: string;
  message: string;
}>;

export function ErrorState({ title = "서비스에 연결할 수 없음", message }: ErrorStateProps) {
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
      <strong>MCP Hub 운영 정보를 불러오는 중...</strong>
      <p>운영 서비스에 연결하고 최신 상태를 준비하고 있습니다.</p>
    </section>
  );
}
