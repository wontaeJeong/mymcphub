import { AccessPageContent } from "../../access/content";
import { readAccessRequestPrefill } from "../../access/page-helpers";

type UserAccessPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function UserAccessPage({ searchParams }: UserAccessPageProps) {
  const prefill = readAccessRequestPrefill(await searchParams);
  return <AccessPageContent mode="user" prefill={prefill} />;
}
