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
          <h2>Emergency Deny Enable</h2>
          <p>Enable the Control Plane emergency deny circuit with an audit-ready reason.</p>
          <div className="field">
            <label htmlFor="reason">Reason</label>
            <textarea id="reason" name="reason" required placeholder="Incident reference and decision rationale" />
          </div>
          <label className="danger-confirm">
            <input type="checkbox" name="confirmEmergencyDeny" required />
            Confirm this will deny gateway access while the Control Plane emergency mode is active.
          </label>
          <div className="form-actions">
            <button className="button button--danger" type="submit" disabled={denyPending}>{denyPending ? "Enabling..." : "Enable deny"}</button>
            {denyState.message ? <span className="muted">{denyState.message}</span> : null}
          </div>
        </form>
        <Surface>
          <h2>Emergency Deny Disable</h2>
          <p>Unavailable in prompt 05: no existing Control Plane endpoint was provided for disabling emergency deny, so the Web UI does not invent one.</p>
          <StatusPill tone="warning">Unavailable</StatusPill>
        </Surface>
      </div>
      <div className="form-grid">
        <form className="form-card" action={serverAction}>
          <h2>Server Disable</h2>
          <p>Disable a selected registered server through /api/servers/:serverId/disable.</p>
          {enabledServers.length > 0 ? (
            <>
              <div className="field">
                <label htmlFor="disableServerId">Server</label>
                <select id="disableServerId" name="serverId" required>
                  {enabledServers.map((server) => (
                    <option value={server.id} key={server.id}>{server.displayName}</option>
                  ))}
                </select>
              </div>
              <label className="danger-confirm">
                <input type="checkbox" name="confirmServerDisable" required />
                Confirm this server should be disabled for emergency containment.
              </label>
              <div className="form-actions">
                <button className="button button--danger" type="submit" disabled={serverPending}>{serverPending ? "Disabling..." : "Disable server"}</button>
                {serverState.message ? <span className="muted">{serverState.message}</span> : null}
              </div>
            </>
          ) : <EmptyState title="No enabled servers" description="There are no enabled servers available for emergency disable." />}
        </form>
        <form className="form-card" action={toolAction}>
          <h2>Tool Disable</h2>
          <p>Disable a selected tool through /api/servers/:serverId/tools/:toolId/disable.</p>
          {enabledTools.length > 0 ? (
            <>
              <div className="field">
                <label htmlFor="disableToolRef">Tool</label>
                <select id="disableToolRef" name="toolRef" required>
                  {enabledTools.map((tool) => (
                    <option value={`${tool.serverId}::${tool.id}`} key={`${tool.serverId}:${tool.id}`}>{tool.serverName} · {tool.name}</option>
                  ))}
                </select>
              </div>
              <label className="danger-confirm">
                <input type="checkbox" name="confirmToolDisable" required />
                Confirm this tool should be disabled for emergency containment.
              </label>
              <div className="form-actions">
                <button className="button button--danger" type="submit" disabled={toolPending}>{toolPending ? "Disabling..." : "Disable tool"}</button>
                {toolState.message ? <span className="muted">{toolState.message}</span> : null}
              </div>
            </>
          ) : <EmptyState title="No enabled tools" description="There are no enabled tools available for emergency disable." />}
        </form>
      </div>
      <form className="form-card" action={revokeAction}>
        <h2>Revoke All Grants For Server</h2>
        <p>Immediately revoke all active grants for one MCP server through /api/admin/revoke-server-grants/:serverId. No global all-server revoke endpoint is used or invented.</p>
        {servers.length > 0 ? (
          <>
            <div className="field">
              <label htmlFor="adminServerId">Server</label>
              <select id="adminServerId" name="serverId" required>
                {servers.map((server) => (
                  <option value={server.id} key={server.id}>{server.displayName}</option>
                ))}
              </select>
            </div>
            <label className="danger-confirm">
              <input type="checkbox" name="confirmRevokeServerGrants" required />
              Confirm every grant for the selected server should be revoked.
            </label>
            <div className="form-actions">
              <button className="button button--danger" type="submit" disabled={revokePending}>{revokePending ? "Revoking..." : "Revoke server grants"}</button>
              {revokeState.message ? <span className="muted">{revokeState.message}</span> : null}
            </div>
          </>
        ) : <EmptyState title="No servers" description="Grant revocation requires a registered server." />}
      </form>
    </div>
  );
}
