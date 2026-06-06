"use client";

import { useActionState } from "react";

import { createServerAction } from "../app/actions";
import { initialFormActionState } from "../app/action-state";

export function ServerRegistrationForm() {
  const [state, formAction, pending] = useActionState(createServerAction, initialFormActionState);

  return (
    <form className="form-card" action={formAction}>
      <h2>Register Server</h2>
      <p>Submit a concise manifest to POST /api/servers using the Control Plane McpServerManifestSchema contract.</p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="registerSlug">Slug</label>
          <input id="registerSlug" name="slug" required pattern="[a-z0-9-]+" placeholder="internal-tools" />
        </div>
        <div className="field">
          <label htmlFor="registerDisplayName">Display name</label>
          <input id="registerDisplayName" name="displayName" required placeholder="Internal Tools MCP Server" />
        </div>
        <div className="field">
          <label htmlFor="registerOwnerTeamId">Owner team ID</label>
          <input id="registerOwnerTeamId" name="ownerTeamId" required placeholder="UUID for owning team" />
        </div>
        <div className="field">
          <label htmlFor="registerEnvironment">Environment</label>
          <select id="registerEnvironment" name="environment" required>
            <option value="dev">dev</option>
            <option value="stg">stg</option>
            <option value="prod">prod</option>
            <option value="shared">shared</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="registerTransport">Transport</label>
          <select id="registerTransport" name="transport" required>
            <option value="streamable_http">streamable_http</option>
            <option value="sse_legacy">sse_legacy</option>
            <option value="stdio_adapter">stdio_adapter</option>
            <option value="external">external</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="registerRiskLevel">Server risk</label>
          <select id="registerRiskLevel" name="riskLevel" required>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="registerDescription">Description</label>
        <textarea id="registerDescription" name="description" placeholder="Operational purpose and ownership notes" />
      </div>
      <div className="field">
        <label htmlFor="registerUpstreamUrl">Upstream URL</label>
        <input id="registerUpstreamUrl" name="upstreamUrl" type="url" placeholder="Optional for stdio adapters" />
      </div>
      <label className="danger-confirm registration-toggle">
        <input type="checkbox" name="enabled" defaultChecked />
        Register server as enabled.
      </label>
      <div className="form-grid registration-tool-grid">
        <div className="field">
          <label htmlFor="registerToolName">Initial tool name</label>
          <input id="registerToolName" name="toolName" required placeholder="search_docs" />
        </div>
        <div className="field">
          <label htmlFor="registerToolRiskLevel">Tool risk</label>
          <select id="registerToolRiskLevel" name="toolRiskLevel" required>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="registerToolDescription">Initial tool description</label>
        <input id="registerToolDescription" name="toolDescription" placeholder="What this tool does" />
      </div>
      <div className="field">
        <label htmlFor="registerToolInputSchema">Input schema JSON</label>
        <textarea id="registerToolInputSchema" name="toolInputSchema" required defaultValue={'{"type":"object","properties":{}}'} />
      </div>
      <label className="danger-confirm registration-toggle">
        <input type="checkbox" name="toolEnabled" defaultChecked />
        Register initial tool as enabled.
      </label>
      <div className="form-actions">
        <button className="button" type="submit" disabled={pending}>{pending ? "Registering..." : "Register server"}</button>
        {state.message ? <span className="muted" role="status">{state.message}</span> : null}
      </div>
    </form>
  );
}
