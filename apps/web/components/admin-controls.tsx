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
          <h2>Enable emergency deny</h2>
          <p>Turn on the emergency deny circuit with an audit-ready reason during an active incident.</p>
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
          <h2>Disable emergency deny</h2>
          <p>Feature not supported by this backend yet. Use the documented incident recovery path instead of an unverified UI action.</p>
          <StatusPill tone="warning">Unsupported</StatusPill>
        </Surface>
      </div>
      <div className="form-grid">
        <form className="form-card" action={serverAction}>
          <h2>Disable server</h2>
          <p>Contain one registered server by disabling it for client use.</p>
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
          <h2>Disable tool</h2>
          <p>Contain one tool without disabling the whole server.</p>
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
        <h2>Revoke all grants for a server</h2>
        <p>Immediately revoke active grants for one selected server. This does not revoke grants globally.</p>
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
