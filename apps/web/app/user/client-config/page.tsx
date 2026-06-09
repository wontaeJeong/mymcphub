import { ClientConfigPageContent } from "../../client-config/content";

type UserClientConfigPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default function UserClientConfigPage({ searchParams }: UserClientConfigPageProps) {
  return <ClientConfigPageContent searchParams={searchParams} />;
}
