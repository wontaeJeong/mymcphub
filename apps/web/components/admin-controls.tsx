"use client";

import { useActionState } from "react";
import { EmptyState, Surface, StatusPill } from "@mcp-hub/ui";

import { adminDisableServerAction, adminDisableToolAction, emergencyDenyAction, revokeServerGrantsAction } from "../app/actions";
import { initialFormActionState } from "../app/action-state";
import type { ApiMcpServer } from "../lib/api";

export type AdminToolOption = Readonly<{
  id: string;
  serverId: string;
  serverName: string;
  name: string;
  enabled: boolean;
}>;

export function AdminControls({ servers, tools }: Readonly<{ servers: ApiMcpServer[]; tools: AdminToolOption[] }>) {
  const [denyState, denyAction, denyPending] = useActionState(emergencyDenyAction, initialFormActionState);
  const [revokeState, revokeAction, revokePending] = useActionState(revokeServerGrantsAction, initialFormActionState);
  const [serverState, serverAction, serverPending] = useActionState(adminDisableServerAction, initialFormActionState);
  const [toolState, toolAction, toolPending] = useActionState(adminDisableToolAction, initialFormActionState);
  const enabledServers = servers.filter((server) => server.enabled);
  const enabledTools = tools.filter((tool) => tool.enabled);

  return (
    <div className="page-stack">
      <form className="form-card panel--accent" action={denyAction}>
        <h2>전체 차단</h2>
        <p>모든 Gateway 접근을 즉시 거부합니다.</p>
        <div className="field">
          <label htmlFor="reason">사유</label>
          <textarea id="reason" name="reason" required placeholder="인시던트 번호, 영향 범위, 결정 근거" />
        </div>
        <label className="danger-confirm">
          <input type="checkbox" name="confirmEmergencyDeny" required />
          전체 접근이 차단됨을 확인합니다.
        </label>
        <div className="form-actions">
          <button className="button button--danger" type="submit" disabled={denyPending}>{denyPending ? "차단 중..." : "전체 차단"}</button>
          {denyState.message ? <span className="muted">{denyState.message}</span> : null}
        </div>
      </form>
      <Surface>
        <details className="schema-viewer">
          <summary>전체 차단 해제</summary>
          <p>해제 절차는 운영 런북에 따라 감사 가능한 변경으로 진행하세요.</p>
          <StatusPill tone="warning">수동 해제 필요</StatusPill>
        </details>
      </Surface>
      <section>
        <h2>위험 작업</h2>
        <p className="muted">아래 조치는 선택한 서버, 도구, 권한 범위에 직접 영향을 줍니다. 대상 이름을 다시 확인한 뒤 실행하세요.</p>
        <div className="form-grid">
          <form className="form-card" action={serverAction}>
            <h2>서버 비활성화</h2>
            <p>선택한 서버를 비활성화해 연결을 중단합니다.</p>
            {enabledServers.length > 0 ? (
              <>
                <div className="field">
                  <label htmlFor="disableServerId">서버</label>
                  <select id="disableServerId" name="serverId" required>
                    {enabledServers.map((server) => (
                      <option value={server.id} key={server.id}>{server.displayName}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="confirmServerName">확인용 대상 이름</label>
                  <input id="confirmServerName" required placeholder="선택한 서버 이름을 입력" />
                </div>
                <label className="danger-confirm">
                  <input type="checkbox" name="confirmServerDisable" required />
                  이 서버의 연결이 중단될 수 있음을 확인합니다.
                </label>
                <div className="form-actions">
                  <button className="button button--danger" type="submit" disabled={serverPending}>{serverPending ? "비활성화 중..." : "서버 비활성화"}</button>
                  {serverState.message ? <span className="muted">{serverState.message}</span> : null}
                </div>
              </>
            ) : <EmptyState title="활성 서버 없음" description="긴급 비활성화에 사용할 수 있는 활성 서버가 없습니다." />}
          </form>
          <form className="form-card" action={toolAction}>
            <h2>도구 비활성화</h2>
            <p>선택한 도구 호출을 중단합니다.</p>
            {enabledTools.length > 0 ? (
              <>
                <div className="field">
                  <label htmlFor="disableToolRef">도구</label>
                  <select id="disableToolRef" name="toolRef" required>
                    {enabledTools.map((tool) => (
                      <option value={`${tool.serverId}::${tool.id}`} key={`${tool.serverId}:${tool.id}`}>{tool.serverName} · {tool.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="confirmToolName">확인용 대상 이름</label>
                  <input id="confirmToolName" required placeholder="선택한 도구 이름을 입력" />
                </div>
                <label className="danger-confirm">
                  <input type="checkbox" name="confirmToolDisable" required />
                  이 도구 호출이 중단될 수 있음을 확인합니다.
                </label>
                <div className="form-actions">
                  <button className="button button--danger" type="submit" disabled={toolPending}>{toolPending ? "비활성화 중..." : "도구 비활성화"}</button>
                  {toolState.message ? <span className="muted">{toolState.message}</span> : null}
                </div>
              </>
            ) : <EmptyState title="활성 도구 없음" description="긴급 비활성화에 사용할 수 있는 활성 도구가 없습니다." />}
          </form>
        </div>
        <form className="form-card" action={revokeAction}>
          <h2>서버의 모든 권한 회수</h2>
          <p>하나의 서버에 대한 모든 활성 권한을 즉시 회수합니다.</p>
          {servers.length > 0 ? (
            <>
              <div className="field">
                <label htmlFor="adminServerId">서버</label>
                <select id="adminServerId" name="serverId" required>
                  {servers.map((server) => (
                    <option value={server.id} key={server.id}>{server.displayName}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="confirmRevokeServerName">확인용 대상 이름</label>
                <input id="confirmRevokeServerName" required placeholder="권한을 회수할 서버 이름을 입력" />
              </div>
              <label className="danger-confirm">
                <input type="checkbox" name="confirmRevokeServerGrants" required />
                  선택한 서버의 모든 권한을 회수합니다.
              </label>
              <div className="form-actions">
                <button className="button button--danger" type="submit" disabled={revokePending}>{revokePending ? "회수 중..." : "서버 권한 회수"}</button>
                {revokeState.message ? <span className="muted">{revokeState.message}</span> : null}
              </div>
            </>
          ) : <EmptyState title="서버 없음" description="권한 회수에는 등록된 서버가 필요합니다." />}
        </form>
      </section>
    </div>
  );
}
