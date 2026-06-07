import { CatalogPageContent } from "../../catalog/content";

type CatalogPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default function UserCatalogPage(props: CatalogPageProps) {
  return <CatalogPageContent {...props} mode="user" />;
}
