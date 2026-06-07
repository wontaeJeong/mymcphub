import { AuditPageContent } from "../../audit/content";

type AdminAuditPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default function AdminAuditPage(props: AdminAuditPageProps) {
  return <AuditPageContent {...props} />;
}
