import { AccessPageContent } from "../../access/content";

type UserAccessPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default function UserAccessPage({ searchParams }: UserAccessPageProps) {
  return <AccessPageContent mode="user" searchParams={searchParams} />;
}
