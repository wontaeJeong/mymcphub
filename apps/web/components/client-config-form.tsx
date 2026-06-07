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
  const selectedProfile = state.selectedProfile ?? "local";

  return (
    <form className="form-card" action={formAction}>
      <h2>Generate client setup</h2>
      <p>Create a client-ready snippet after the server is enabled and the operator has the right access grant.</p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="serverId">MCP server</label>
          <select id="serverId" name="serverId" required>
            {servers.map((server) => (
              <option value={server.id} key={server.id}>{server.displayName}</option>
            ))}
          </select>
          <p className="field__hint">Only enabled servers are listed.</p>
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
          <p className="field__hint">Choose the client where this setup will be pasted.</p>
        </div>
        <div className="field">
          <label htmlFor="profile">Client profile</label>
          <input id="profile" name="profile" defaultValue={selectedProfile} placeholder="local, prod, incident-response" />
          <p className="field__hint">Use a profile name that matches the operator workflow.</p>
        </div>
      </div>
      <div className="submission-summary" aria-label="Client setup summary">
        <strong>Before generating</strong>
        <ul>
          <li>The selected server is enabled and healthy enough for client traffic.</li>
          <li>Your user, team, or service account has access to the tools you need.</li>
          <li>The profile name is safe to share in local setup instructions.</li>
        </ul>
      </div>
      <div className="form-actions">
        <button className="button" type="submit" disabled={pending}>{pending ? "Generating..." : "Generate config"}</button>
        {state.message ? <span className="muted">{state.message}</span> : null}
      </div>
      <div className="config-summary">
        <p><strong>Selected server:</strong> {selectedServer?.displayName ?? "No server selected"}</p>
        <p><strong>Client:</strong> {selectedClient}</p>
        <p><strong>Profile:</strong> {selectedProfile}</p>
        <p><strong>Gateway URL:</strong> {state.gatewayUrl ? <CopyButton value={state.gatewayUrl} label="Copy URL" /> : <span className="muted">Generate setup to reveal the gateway URL.</span>}</p>
        <p><strong>How to test:</strong> {state.gatewayUrl ? <code>mcphubctl --profile {selectedProfile} health && mcp inspector {state.gatewayUrl}</code> : <span className="muted">Generate setup to reveal the health check command.</span>}</p>
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
