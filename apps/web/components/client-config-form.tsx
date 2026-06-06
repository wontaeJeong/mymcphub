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
      <h2>Generate Client Config</h2>
      <p>Create a config snippet directly from the Control Plane API for a selected enabled server.</p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="serverId">MCP server</label>
          <select id="serverId" name="serverId" required>
            {servers.map((server) => (
              <option value={server.id} key={server.id}>{server.displayName}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="client">Client</label>
          <select id="client" name="client" defaultValue="opencode" required>
            <option value="generic">Generic remote MCP</option>
            <option value="opencode">opencode</option>
            <option value="claude-code">Claude Code</option>
            <option value="codex">Codex</option>
            <option value="vscode">VS Code</option>
          </select>
        </div>
      </div>
      <div className="form-actions">
        <button className="button" type="submit" disabled={pending}>{pending ? "Generating..." : "Generate config"}</button>
        {state.message ? <span className="muted">{state.message}</span> : null}
      </div>
      <div className="config-summary">
        <p><strong>Selected server:</strong> {selectedServer?.displayName ?? "No server selected"}</p>
        <p><strong>Selected client:</strong> {selectedClient}</p>
        <p><strong>Gateway URL:</strong> {state.gatewayUrl ? <CopyButton value={state.gatewayUrl} label="Copy URL" /> : <span className="muted">Unavailable from generated Control Plane response</span>}</p>
      </div>
      {state.payload ? (
        <div className="grid">
          <CopyButton value={state.payload} label="Copy config" />
          <pre className="code-block">{state.payload}</pre>
        </div>
      ) : null}
    </form>
  );
}
