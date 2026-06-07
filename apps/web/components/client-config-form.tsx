"use client";

import { useActionState } from "react";

import { generateClientConfigAction } from "../app/actions";
import { initialFormActionState } from "../app/action-state";
import { CopyButton } from "./copy-button";
import type { ApiMcpServer } from "../lib/api";

export function ClientConfigForm({ servers }: Readonly<{ servers: ApiMcpServer[] }>) {
  const [state, formAction, pending] = useActionState(generateClientConfigAction, initialFormActionState);
  const selectedServer = servers.find((server) => server.id === state.selectedServerId) ?? servers[0];
  const selectedClient = state.selectedClient ?? "opencode";

  return (
    <form className="form-card" action={formAction}>
      <h2>클라이언트 설정 생성</h2>
      <p>선택한 활성 서버에 대한 설정 스니펫을 제어 플레인 API에서 바로 생성합니다.</p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="serverId">MCP 서버</label>
          <select id="serverId" name="serverId" required>
            {servers.map((server) => (
              <option value={server.id} key={server.id}>{server.displayName}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="client">클라이언트</label>
          <select id="client" name="client" defaultValue="opencode" required>
            <option value="generic">일반 원격 MCP</option>
            <option value="opencode">opencode</option>
            <option value="claude-code">Claude Code</option>
            <option value="codex">Codex</option>
            <option value="vscode">VS Code</option>
          </select>
        </div>
      </div>
      <div className="form-actions">
        <button className="button" type="submit" disabled={pending}>{pending ? "생성 중..." : "설정 생성"}</button>
        {state.message ? <span className="muted">{state.message}</span> : null}
      </div>
      <div className="config-summary">
        <p><strong>선택한 서버:</strong> {selectedServer?.displayName ?? "선택한 서버 없음"}</p>
        <p><strong>선택한 클라이언트:</strong> {selectedClient}</p>
        <p><strong>게이트웨이 URL:</strong> {state.gatewayUrl ? <CopyButton value={state.gatewayUrl} label="URL 복사" /> : <span className="muted">생성된 제어 플레인 응답에서 확인할 수 없음</span>}</p>
      </div>
      {state.payload ? (
        <div className="grid">
          <CopyButton value={state.payload} label="설정 복사" />
          <pre className="code-block">{state.payload}</pre>
        </div>
      ) : null}
    </form>
  );
}
