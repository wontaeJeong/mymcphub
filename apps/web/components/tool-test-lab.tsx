"use client";

import { useActionState } from "react";
import { EmptyState, StatusPill } from "@mcp-hub/ui";

import { testPolicyCallAction } from "../app/actions";
import { initialFormActionState } from "../app/action-state";
import type { ToolTestOption } from "../app/tools/page-helpers";
import type { PolicyEffect } from "../lib/api";
import { policyTone } from "./format";
import { CopyButton } from "./copy-button";

const sampleArguments = JSON.stringify({ query: "release runbook", token: "paste-redacted-secret-here" }, null, 2);

export function ToolTestLab({ options }: Readonly<{ options: ToolTestOption[] }>) {
  const [state, formAction, pending] = useActionState(testPolicyCallAction, initialFormActionState);
  const selectedToolRef = state.selectedToolRef ?? options[0]?.value ?? "";
  const policyEffect = readPolicyEffect(state.policyEffect);

  return (
    <form className="form-card test-lab" action={formAction}>
      <h2>Dry-run Tool Test Lab</h2>
      <p>Build a policy-protected tool-call payload. Dry-run mode never calls the upstream MCP server; it returns the policy decision and locally redacted argument detail for review.</p>
      {options.length > 0 ? (
        <>
          <input type="hidden" name="dryRun" value="true" />
          <div className="form-grid">
            <div className="field">
              <label htmlFor="toolTestRef">Tool</label>
              <select id="toolTestRef" name="toolTestRef" defaultValue={selectedToolRef} required>
                {options.map((option) => (
                  <option value={option.value} key={option.value} disabled={!option.enabled}>{option.label}{option.enabled ? "" : " (disabled)"}</option>
                ))}
              </select>
            </div>
            <label className="danger-confirm test-lab__step-up">
              <input type="checkbox" name="stepUp" />
              Include step-up confirmation signal for critical-risk dry runs.
            </label>
          </div>
          <div className="field">
            <label htmlFor="argumentsJson">Payload editor</label>
            <textarea id="argumentsJson" name="argumentsJson" required defaultValue={sampleArguments} />
          </div>
          <div className="form-actions">
            <button className="button" type="submit" disabled={pending}>{pending ? "Running dry-run..." : "Run policy dry-run"}</button>
            {policyEffect ? <StatusPill tone={policyTone(policyEffect)}>{policyEffect}</StatusPill> : null}
            {state.message ? <span className="muted" role="status">{state.message}</span> : null}
          </div>
          {state.payload ? (
            <div className="grid">
              <CopyButton value={state.payload} label="Copy dry-run result" />
              <pre className="code-block">{state.payload}</pre>
            </div>
          ) : null}
        </>
      ) : <EmptyState title="No data yet" description="Register a server with at least one tool before running a policy dry-run." />}
    </form>
  );
}

function readPolicyEffect(value: string | undefined): PolicyEffect | undefined {
  if (value === "allow" || value === "deny" || value === "needs_approval") {
    return value;
  }

  return undefined;
}
