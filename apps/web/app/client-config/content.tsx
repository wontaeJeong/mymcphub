import { EmptyState } from "@mcp-hub/ui";

import { PageHero } from "../../components/chrome";
import { ClientConfigForm } from "../../components/client-config-form";
import { ErrorState } from "../../components/states";
import { listServers } from "../../lib/api";
import { loadResult } from "../../lib/result";
import { readClientConfigInitialValues, type QueryParams } from "./page-helpers";

export async function ClientConfigPageContent({
  searchParams,
}: Readonly<{ searchParams?: Promise<QueryParams> }>) {
  const filtersPromise = searchParams ?? Promise.resolve({});
  const [filters, servers] = await Promise.all([
    filtersPromise,
    loadResult(listServers()),
  ]);
  const enabledServers = servers.ok ? servers.data.items.filter((server) => server.enabled) : [];
  const initialValues = readClientConfigInitialValues(filters, enabledServers);

  return (
    <div className="page-stack">
      <PageHero eyebrow="클라이언트 설정 생성기" title="승인된 서버를 클라이언트에 연결하세요." description="서버와 클라이언트를 선택하면 게이트웨이를 경유하는 설정을 생성합니다." />
      {servers.ok && enabledServers.length > 0 ? <ClientConfigForm servers={enabledServers} initialValues={initialValues} /> : servers.ok ? <EmptyState title="활성 서버 없음" description="클라이언트 설정은 활성 서버에 대해서만 생성할 수 있습니다." /> : <ErrorState message={servers.error} />}
    </div>
  );
}
