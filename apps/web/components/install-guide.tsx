import Link from "next/link";
import { EmptyState, Surface } from "@mcp-hub/ui";

import type { ApiMcpServer, ClientConfigKind } from "../lib/api";
import { SectionHeader } from "./chrome";
import { ClientConfigForm } from "./client-config-form";
import { CopyButton } from "./copy-button";
import { formatEnvironment, formatTransport } from "./format";

export type InstallGuideProps = Readonly<{
  server: ApiMcpServer;
  hasAccess: boolean;
  accessRequestHref: string;
}>;

const clientGuides: ReadonlyArray<{
  kind: ClientConfigKind;
  label: string;
  description: string;
}> = [
  {
    kind: "opencode",
    label: "opencode",
    description: "opencode용 원격 MCP 설정을 생성합니다.",
  },
  {
    kind: "claude-code",
    label: "Claude Code",
    description: "Claude Code에 붙여 넣을 설정을 생성합니다.",
  },
  {
    kind: "codex",
    label: "Codex",
    description: "Codex용 원격 MCP 설정을 생성합니다.",
  },
  {
    kind: "vscode",
    label: "VS Code",
    description: "VS Code 클라이언트 설정을 생성합니다.",
  },
  {
    kind: "generic",
    label: "일반 원격 MCP",
    description: "URL과 토큰 요구사항만 포함한 범용 설정입니다.",
  },
];

export function InstallGuide({ server, hasAccess, accessRequestHref }: InstallGuideProps) {
  const gatewayPath = `/mcp/${server.slug}`;
  const canGenerate = server.enabled && !server.quarantined && hasAccess;

  return (
    <Surface>
      <SectionHeader
        title="클라이언트 연결"
        description="사용할 클라이언트를 선택해 설정을 생성합니다."
        action={
          hasAccess ? <Link className="button button--ghost" href={clientConfigHref(server.id, "opencode")}>
            설정 생성기로 이동
          </Link> : undefined
        }
      />
      <div className="grid">
        <div className="config-summary">
          <p>
            <strong>Gateway 경로:</strong> <CopyButton value={gatewayPath} label="경로 복사" />
          </p>
          <p>
            <strong>Gateway URL:</strong>{" "}
            <span className="muted">
              전체 URL은 설정 생성 후 확인합니다.
            </span>
          </p>
          <p>
            <strong>전송/환경:</strong> {formatTransport(server.transport)} · {formatEnvironment(server.environment)}
          </p>
          <p>
            <strong>토큰:</strong>{" "}
            <span className="muted">
              토큰은 환경 변수로 주입하세요. 설정 파일이나 로그에 저장하지 마세요.
            </span>
          </p>
          <p>
            <strong>테스트 명령:</strong>{" "}
            <code>mcp inspector &lt;생성된 gatewayUrl&gt;</code>
          </p>
        </div>
        {!server.enabled || server.quarantined ? (
          <EmptyState
            title="서버 상태 확인 필요"
            description="비활성 또는 격리된 서버는 설정을 생성할 수 없습니다."
          />
        ) : !canGenerate ? (
          <EmptyState
            title="접근 승인 후 설정을 생성할 수 있습니다"
            description="이 서버를 연결하려면 먼저 접근을 요청하세요."
            action={
              <Link className="button" href={accessRequestHref}>
                접근 요청
              </Link>
            }
          />
        ) : (
          <>
            <div className="card-grid">
              {clientGuides.map((client) => (
                <Surface key={client.kind}>
                  <h3>{client.label}</h3>
                  <p className="muted">{client.description}</p>
                  <Link className="button button--ghost" href={clientConfigHref(server.id, client.kind)}>
                    {client.label} 설정 생성
                  </Link>
                </Surface>
              ))}
            </div>
            <ClientConfigForm
              servers={[server]}
              initialValues={{ serverId: server.id, client: "opencode", profile: "local" }}
            />
          </>
        )}
      </div>
    </Surface>
  );
}

function clientConfigHref(serverId: string, client: ClientConfigKind) {
  const params = new URLSearchParams({
    serverId,
    client,
    profile: "local",
  });

  return `/user/client-config?${params.toString()}`;
}
