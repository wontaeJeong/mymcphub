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
    description: "원격 MCP 서버 항목과 bearer header를 포함한 mcp 설정을 생성합니다.",
  },
  {
    kind: "claude-code",
    label: "Claude Code",
    description: "Claude Code remote MCP 형식에 맞춘 placeholder 설정을 생성합니다.",
  },
  {
    kind: "codex",
    label: "Codex",
    description: "Codex에서 확인할 수 있는 remote MCP 서버 설정을 생성합니다.",
  },
  {
    kind: "vscode",
    label: "VS Code",
    description: "VS Code MCP client profile에 붙여 넣을 remote server 설정을 생성합니다.",
  },
  {
    kind: "generic",
    label: "일반 원격 MCP",
    description: "URL, streamable HTTP transport, bearer token 요구사항만 포함한 범용 설정입니다.",
  },
];

export function InstallGuide({ server, hasAccess, accessRequestHref }: InstallGuideProps) {
  const gatewayPath = `/mcp/${server.slug}`;
  const canGenerate = server.enabled && !server.quarantined && hasAccess;

  return (
    <Surface>
      <SectionHeader
        title="설치 / 클라이언트 설정"
        description="Gateway를 통해 opencode, Claude Code, Codex, VS Code 또는 일반 원격 MCP 클라이언트 설정을 생성합니다."
        action={
          <Link className="button button--ghost" href={clientConfigHref(server.id, "opencode")}>
            전체 생성기로 이동
          </Link>
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
              정확한 호스트와 전체 URL은 /api/client-config/generate 응답에서 생성 후 확인합니다.
            </span>
          </p>
          <p>
            <strong>전송/환경:</strong> {formatTransport(server.transport)} · {formatEnvironment(server.environment)}
          </p>
          <p>
            <strong>토큰:</strong>{" "}
            <span className="muted">
              클라이언트에는 MCPHUB_TOKEN 같은 환경 변수로 bearer token을 주입하고, 설정 JSON이나 로그에 원문 토큰을 저장하지 마세요.
            </span>
          </p>
          <p>
            <strong>테스트 명령:</strong>{" "}
            <code>mcp inspector &lt;생성된 gatewayUrl&gt;</code>
          </p>
        </div>
        <div className="card-grid">
          {clientGuides.map((client) => (
            <Surface key={client.kind}>
              <h3>{client.label}</h3>
              <p className="muted">{client.description}</p>
              <Link className="button button--ghost" href={clientConfigHref(server.id, client.kind)}>
                {client.label} 선택
              </Link>
            </Surface>
          ))}
        </div>
        {!server.enabled || server.quarantined ? (
          <EmptyState
            title="설정 생성 전 서버 상태 확인 필요"
            description="비활성 또는 격리된 서버는 Gateway에서 사용할 수 없습니다. 운영 상태가 복구된 뒤 클라이언트 설정을 생성하세요."
          />
        ) : canGenerate ? (
          <ClientConfigForm
            servers={[server]}
            initialValues={{ serverId: server.id, client: "opencode", profile: "local" }}
          />
        ) : (
          <EmptyState
            title="접근 요청 후 설정을 생성하세요"
            description="현재 세션에 이 서버 권한이 없습니다. 먼저 접근 승인 요청을 제출한 뒤 생성된 gatewayUrl과 설정 JSON을 사용하세요."
            action={
              <Link className="button" href={accessRequestHref}>
                접근 요청 열기
              </Link>
            }
          />
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
