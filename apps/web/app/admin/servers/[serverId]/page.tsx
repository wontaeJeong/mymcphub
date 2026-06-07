import { AdminServerDetailPageContent } from "../../../servers/[serverId]/content";

type AdminServerDetailPageProps = Readonly<{
  params: Promise<{ serverId: string }>;
}>;

export default function AdminServerDetailPage(props: AdminServerDetailPageProps) {
  return <AdminServerDetailPageContent {...props} />;
}
