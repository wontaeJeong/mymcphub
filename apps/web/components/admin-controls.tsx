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
      <div className="form-grid">
        <form className="form-card" action={denyAction}>
          <h2>긴급 거부 활성화</h2>
          <p>감사 가능한 사유와 함께 제어 플레인의 긴급 거부 회로를 활성화합니다.</p>
          <div className="field">
            <label htmlFor="reason">사유</label>
            <textarea id="reason" name="reason" required placeholder="장애 참조와 결정 근거" />
          </div>
          <label className="danger-confirm">
            <input type="checkbox" name="confirmEmergencyDeny" required />
            제어 플레인 긴급 모드가 활성화된 동안 게이트웨이 접근이 거부됨을 확인합니다.
          </label>
          <div className="form-actions">
            <button className="button button--danger" type="submit" disabled={denyPending}>{denyPending ? "활성화 중..." : "거부 활성화"}</button>
            {denyState.message ? <span className="muted">{denyState.message}</span> : null}
          </div>
        </form>
        <Surface>
          <h2>긴급 거부 비활성화</h2>
          <p>prompt 05 범위에서 사용할 수 없습니다. 긴급 거부를 비활성화하는 제어 플레인 엔드포인트가 제공되지 않아 Web UI에서 새로 만들지 않습니다.</p>
          <StatusPill tone="warning">사용 불가</StatusPill>
        </Surface>
      </div>
      <div className="form-grid">
        <form className="form-card" action={serverAction}>
          <h2>서버 비활성화</h2>
          <p>선택한 등록 서버를 /api/servers/:serverId/disable로 비활성화합니다.</p>
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
              <label className="danger-confirm">
                <input type="checkbox" name="confirmServerDisable" required />
                긴급 확산 방지를 위해 이 서버를 비활성화해야 함을 확인합니다.
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
          <p>선택한 도구를 /api/servers/:serverId/tools/:toolId/disable로 비활성화합니다.</p>
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
              <label className="danger-confirm">
                <input type="checkbox" name="confirmToolDisable" required />
                긴급 확산 방지를 위해 이 도구를 비활성화해야 함을 확인합니다.
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
        <p>하나의 MCP 서버에 대한 모든 활성 권한을 /api/admin/revoke-server-grants/:serverId로 즉시 회수합니다. 전체 서버 일괄 회수 엔드포인트는 사용하거나 만들지 않습니다.</p>
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
            <label className="danger-confirm">
              <input type="checkbox" name="confirmRevokeServerGrants" required />
              선택한 서버의 모든 권한을 회수해야 함을 확인합니다.
            </label>
            <div className="form-actions">
              <button className="button button--danger" type="submit" disabled={revokePending}>{revokePending ? "회수 중..." : "서버 권한 회수"}</button>
              {revokeState.message ? <span className="muted">{revokeState.message}</span> : null}
            </div>
          </>
        ) : <EmptyState title="서버 없음" description="권한 회수에는 등록된 서버가 필요합니다." />}
      </form>
    </div>
  );
}
