import { redirect } from "next/navigation";

type ServerDetailPageProps = Readonly<{
  params: Promise<{ serverId: string }>;
}>;

export default async function ServerDetailPage({ params }: ServerDetailPageProps) {
  const { serverId } = await params;
  redirect(`/user/servers/${encodeURIComponent(serverId)}`);
}
