export type EmptyStateProps = Readonly<{
  title: string;
  description: string;
}>;

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <section aria-label={title}>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}
