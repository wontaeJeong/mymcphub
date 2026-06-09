"use client";

import { useActionState } from "react";

import { generateClientConfigAction } from "../app/actions";
import { initialFormActionState } from "../app/action-state";
import { CopyButton } from "./copy-button";
import type { ApiMcpServer, ClientConfigKind } from "../lib/api";

export function ClientConfigForm({
  servers,
  initialValues,
}: Readonly<{
  servers: ApiMcpServer[];
  initialValues?: Readonly<{
    serverId?: string;
    client?: ClientConfigKind;
    profile?: string;
  }>;
}>) {
  const [state, formAction, pending] = useActionState(
    generateClientConfigAction,
    {
      ...initialFormActionState,
      selectedServerId: initialValues?.serverId,
      selectedClient: initialValues?.client,
      selectedProfile: initialValues?.profile,
    },
  );
  const selectedServer =
    servers.find((server) => server.id === state.selectedServerId) ?? servers[0];
  const selectedClient = state.selectedClient ?? "opencode";
  const selectedProfile = state.selectedProfile ?? "local";

  return (
    <form className="form-card" action={formAction}>
      <h2>클라이언트 설정 생성</h2>
      <p>
        서버와 클라이언트만 선택하면 게이트웨이를 통하는 설정을 생성합니다.
      </p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="serverId">MCP 서버</label>
          <select id="serverId" name="serverId" defaultValue={selectedServer?.id} required>
            {servers.map((server) => (
              <option value={server.id} key={server.id}>
                {server.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="client">클라이언트</label>
          <select id="client" name="client" defaultValue={selectedClient} required>
            <option value="generic">일반 원격 MCP</option>
            <option value="opencode">opencode</option>
            <option value="claude-code">Claude Code</option>
            <option value="codex">Codex</option>
            <option value="vscode">VS Code</option>
          </select>
        </div>
      </div>
      <details className="schema-viewer">
        <summary>고급 프로필 옵션</summary>
        <div className="field">
          <label htmlFor="profile">프로필 이름</label>
          <input
            id="profile"
            name="profile"
            defaultValue={selectedProfile}
            placeholder="예: local, prod, incident-response"
          />
        </div>
      </details>
      <div className="form-actions">
        <button className="button" type="submit" disabled={pending}>
          {pending ? "생성 중..." : "설정 생성"}
        </button>
        {state.message ? <span className="muted">{state.message}</span> : null}
      </div>
      {state.gatewayUrl || state.payload ? (
        <div className="config-summary">
          <p>
            <strong>생성된 서버:</strong>{" "}
            {selectedServer?.displayName ?? "선택한 서버 없음"}
          </p>
          <p>
            <strong>클라이언트:</strong> {selectedClient} · {selectedProfile}
          </p>
          {state.gatewayUrl ? (
            <p>
              <strong>게이트웨이 URL:</strong> <CopyButton value={state.gatewayUrl} label="URL 복사" />
            </p>
          ) : null}
          {state.gatewayUrl ? (
            <details className="schema-viewer">
              <summary>테스트 명령 보기</summary>
              <code>
                mcphubctl --profile {selectedProfile} health && mcp inspector{" "}
                {state.gatewayUrl}
              </code>
            </details>
          ) : null}
        </div>
      ) : null}
      {state.payload ? (
        <details className="schema-viewer">
          <summary>설정 JSON 보기</summary>
          <CopyButton value={state.payload} label="설정 복사" />
          <pre className="code-block">{state.payload}</pre>
        </details>
      ) : null}
    </form>
  );
}
