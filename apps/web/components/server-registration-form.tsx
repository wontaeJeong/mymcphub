"use client";

import { useActionState } from "react";

import { createServerAction } from "../app/actions";
import { initialFormActionState } from "../app/action-state";

export function ServerRegistrationForm() {
  const [state, formAction, pending] = useActionState(createServerAction, initialFormActionState);

  return (
    <form className="form-card" action={formAction} id="register-server">
      <h2>Register a server</h2>
      <p>Add one MCP server with a starter tool so operators can review it, grant access, and generate client setup.</p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="registerSlug">Slug</label>
          <input id="registerSlug" name="slug" required pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$" title="Use lowercase letters, numbers, and single dashes between words." placeholder="prod-docs" />
          <p className="field__hint">Lowercase letters, numbers, and dashes. Operators use this to recognize the server quickly.</p>
        </div>
        <div className="field">
          <label htmlFor="registerDisplayName">Display name</label>
          <input id="registerDisplayName" name="displayName" required placeholder="Production Docs" />
          <p className="field__hint">Use the name people already use in runbooks or support channels.</p>
        </div>
        <div className="field">
          <label htmlFor="registerOwnerTeamId">Owner team ID</label>
          <input id="registerOwnerTeamId" name="ownerTeamId" required placeholder="team-platform" />
          <p className="field__hint">Directory team identifier responsible for review, incidents, and lifecycle changes.</p>
        </div>
        <div className="field">
          <label htmlFor="registerEnvironment">Environment</label>
          <select id="registerEnvironment" name="environment" required>
            <option value="dev">dev</option>
            <option value="stg">stg</option>
            <option value="prod">prod</option>
            <option value="shared">shared</option>
          </select>
          <p className="field__hint">Choose where this server is safe to use.</p>
        </div>
        <div className="field">
          <label htmlFor="registerRiskLevel">Server risk</label>
          <select id="registerRiskLevel" name="riskLevel" required>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
          <p className="field__hint">High or critical servers should have tight grants and visible ownership.</p>
        </div>
      </div>
      <div className="field">
        <label htmlFor="registerDescription">Description</label>
        <textarea id="registerDescription" name="description" placeholder="Search production runbooks and release notes owned by Platform." />
        <p className="field__hint">Explain the operator value, not the implementation details.</p>
      </div>
      <div className="field">
        <label htmlFor="registerUpstreamUrl">Upstream URL</label>
        <input id="registerUpstreamUrl" name="upstreamUrl" type="url" placeholder="https://docs.example.com/mcp" />
        <p className="field__hint">Leave blank only when the selected transport does not use an upstream URL.</p>
      </div>
      <label className="danger-confirm registration-toggle">
        <input type="checkbox" name="enabled" defaultChecked />
        Register server as enabled.
      </label>
      <div className="form-grid registration-tool-grid">
        <div className="field">
          <label htmlFor="registerToolName">Initial tool name</label>
          <input id="registerToolName" name="toolName" required placeholder="docs.search" />
          <p className="field__hint">Use the exact tool name clients will call.</p>
        </div>
        <div className="field">
          <label htmlFor="registerToolRiskLevel">Tool risk</label>
          <select id="registerToolRiskLevel" name="toolRiskLevel" required>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
          <p className="field__hint">Set risk based on what the tool can read or change.</p>
        </div>
      </div>
      <div className="field">
        <label htmlFor="registerToolDescription">Initial tool description</label>
        <input id="registerToolDescription" name="toolDescription" placeholder="Search runbooks by query and environment." />
      </div>
      <details className="advanced-fields">
        <summary>Advanced manifest fields</summary>
        <div className="field">
          <label htmlFor="registerTransport">Transport</label>
          <select id="registerTransport" name="transport" required>
            <option value="streamable_http">streamable_http</option>
            <option value="sse_legacy">sse_legacy</option>
            <option value="stdio_adapter">stdio_adapter</option>
            <option value="external">external</option>
          </select>
          <p className="field__hint">Keep the default unless the server uses a legacy or adapter transport.</p>
        </div>
        <div className="field">
          <label htmlFor="registerToolInputSchema">Input schema JSON</label>
          <textarea id="registerToolInputSchema" name="toolInputSchema" required defaultValue={'{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}'} />
          <p className="field__hint">Raw JSON is kept for the backend contract. Start with the sample and tighten it when the tool schema is known.</p>
        </div>
      </details>
      <label className="danger-confirm registration-toggle">
        <input type="checkbox" name="toolEnabled" defaultChecked />
        Register initial tool as enabled.
      </label>
      <div className="submission-summary" aria-label="Registration summary">
        <strong>Before submitting</strong>
        <ul>
          <li>The server owner can respond to incidents and access reviews.</li>
          <li>The environment and risk match how operators should use the server.</li>
          <li>The starter tool name, risk, and schema are ready for grant review.</li>
        </ul>
      </div>
      <div className="form-actions">
        <button className="button" type="submit" disabled={pending}>{pending ? "Registering..." : "Register server"}</button>
        {state.message ? <span className="muted" role="status">{state.message}</span> : null}
      </div>
    </form>
  );
}
