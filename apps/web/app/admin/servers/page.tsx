import { CatalogPageContent } from "../../catalog/content";

type AdminServersPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default function AdminServersPage(props: AdminServersPageProps) {
  return <CatalogPageContent {...props} mode="admin" />;
}
