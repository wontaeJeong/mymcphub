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
      <PageHero eyebrow="클라이언트 설정 생성기" title="승인된 서버를 클라이언트 설정으로 변환하세요." description="opencode, Claude Code, Codex, VS Code 또는 일반 원격 MCP 클라이언트를 위한 실제 /api/client-config/generate 요청을 전송합니다." />
      {servers.ok && enabledServers.length > 0 ? <ClientConfigForm servers={enabledServers} initialValues={initialValues} /> : servers.ok ? <EmptyState title="활성 서버 없음" description="클라이언트 설정은 활성 서버에 대해서만 생성할 수 있습니다." /> : <ErrorState message={servers.error} />}
    </div>
  );
}
