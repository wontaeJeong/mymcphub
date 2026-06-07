import { EmptyState } from "@mcp-hub/ui";

import { createApprovalAction, createGrantAction, revokeGrantAction } from "../actions";
import { PageHero, SectionHeader } from "../../components/chrome";
import { ErrorState } from "../../components/states";
import { GrantTable } from "../../components/tables";
import type { ApiGrant } from "../../lib/api";
import { listGrants, listServers } from "../../lib/api";
import { getCurrentSession } from "../../lib/auth/session";
import { loadResult } from "../../lib/result";

export async function AccessPageContent({ mode = "user" }: Readonly<{ mode?: "user" | "admin" }>) {
  const session = await getCurrentSession();
  const serversPromise = loadResult(listServers());
  const grantsPromise = loadResult(listGrants());
  const [servers, grants] = await Promise.all([serversPromise, grantsPromise]);
  const serverItems = servers.ok ? servers.data.items : [];
  const serverNameById = new Map(serverItems.map((server) => [server.id, server.displayName]));
  const visibleGrants = grants.ok && mode === "user" ? grants.data.items.filter((grant) => grant.subjectId === session?.principal.userId || session?.principal.teamIds.includes(grant.subjectId) || session?.principal.teams.includes(grant.subjectId)) : grants.ok ? grants.data.items : [];

  return (
    <div className="page-stack">
      <PageHero eyebrow="Access Grants" title="Permission paths without guesswork." description={mode === "admin" ? "Review grants, create scoped access, and revoke permissions when risk changes." : "Review your visible grants and request access without needing backend identifiers beyond your project and server."} />
      <section>
        <SectionHeader title="Current grants" description="Active and revoked grants are shown with the server name first, then subject, tools, environment, and reason." />
        {grants.ok && visibleGrants.length > 0 ? <GrantTable grants={visibleGrants} serverNameById={serverNameById} actionSlot={mode === "admin" ? GrantControls : undefined} /> : grants.ok ? <EmptyState title="No data yet" description={mode === "user" ? "No grants match your user or team identifiers yet." : "No grants have been created yet."} /> : <ErrorState message={grants.error} />}
      </section>
      <div className={mode === "admin" ? "form-grid" : "grid"}>
        <form className="form-card" action={createApprovalAction}>
          <h2>Request access approval</h2>
          <p>Ask for a scoped grant by explaining who needs access, which server and tools are needed, and why it is safe.</p>
          {servers.ok && serverItems.length > 0 ? (
            <>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="approvalSubjectType">Subject type</label>
                  <select id="approvalSubjectType" name="subjectType" required>
                    <option value="user">User</option>
                    {mode === "admin" ? <option value="team">Team</option> : null}
                    {mode === "admin" ? <option value="service_account">Service account</option> : null}
                  </select>
                  <p className="field__hint">Choose whether access is for a person, team, or automation identity.</p>
                </div>
                <div className="field">
                  <label htmlFor="approvalEnvironment">Environment</label>
                  <select id="approvalEnvironment" name="environment" required>
                    <option value="dev">dev</option>
                    <option value="stg">stg</option>
                    <option value="prod">prod</option>
                    <option value="shared">shared</option>
                  </select>
                  <p className="field__hint">Match the environment where the tools will be used.</p>
                </div>
              </div>
              <div className="field">
                <label htmlFor="approvalSubjectId">Subject ID</label>
                <input id="approvalSubjectId" name="subjectId" required defaultValue={mode === "user" ? session?.principal.userId : undefined} readOnly={mode === "user"} placeholder="user-alice, team-platform, or svc-docs-bot" />
                <p className="field__hint">Use the directory identifier for the identity receiving access.</p>
              </div>
              <div className="field">
                <label htmlFor="approvalServerId">Server</label>
                <select id="approvalServerId" name="serverId" required>
                  {serverItems.map((server) => <option value={server.id} key={server.id}>{server.displayName}</option>)}
                </select>
                <p className="field__hint">Pick the server that owns the tools you need.</p>
              </div>
              <div className="field">
                <label htmlFor="approvalProjectId">Project ID</label>
                <input id="approvalProjectId" name="projectId" required defaultValue={mode === "user" ? session?.principal.projectId : undefined} readOnly={mode === "user"} placeholder="project-console" />
                <p className="field__hint">The project where the access will be audited.</p>
              </div>
              <div className="field">
                <label htmlFor="approvalRequestedTools">Requested tools</label>
                <input id="approvalRequestedTools" name="requestedTools" required placeholder="docs.search, docs.lookup" />
                <p className="field__hint">Comma-separated tool names. Keep the request as narrow as possible.</p>
              </div>
              <div className="field">
                <label htmlFor="approvalReason">Reason</label>
                <textarea id="approvalReason" name="reason" required placeholder="Investigating a production release issue; access needed for 24 hours." />
                <p className="field__hint">Include duration, operational need, and any safety context reviewers need.</p>
              </div>
              <details className="advanced-fields">
                <summary>Advanced request fields</summary>
                <div className="field">
                  <label htmlFor="requestedAction">Requested action</label>
                  <input id="requestedAction" name="requestedAction" required defaultValue="grant_access" />
                  <p className="field__hint">Default is the normal access-grant workflow.</p>
                </div>
                <div className="field">
                  <label htmlFor="approvalTicketUrl">Ticket URL</label>
                  <input id="approvalTicketUrl" name="ticketUrl" type="url" placeholder="https://tickets.example.test/MCP-123" />
                </div>
                <div className="field">
                  <label htmlFor="approvalRequestedExpiresAt">Requested expiry</label>
                  <input id="approvalRequestedExpiresAt" name="requestedExpiresAt" placeholder="2026-06-08T10:00:00Z" />
                  <p className="field__hint">Use an ISO timestamp when the access should expire automatically.</p>
                </div>
              </details>
              <div className="submission-summary" aria-label="Approval request summary">
                <strong>Before submitting</strong>
                <ul>
                  <li>Subject, server, environment, and tools describe the exact access needed.</li>
                  <li>Reason explains the operator workflow and expected duration.</li>
                  <li>Ticket and expiry are added when your approval policy requires them.</li>
                </ul>
              </div>
              <div className="form-actions"><button className="button" type="submit">Submit approval</button></div>
            </>
          ) : servers.ok ? <EmptyState title="No data yet" description="Register a server before requesting access." /> : <ErrorState message={servers.error} />}
        </form>
        {mode === "admin" ? <form className="form-card" action={createGrantAction}>
          <h2>Create access grant</h2>
          <p>Create a scoped grant directly when approval has already been recorded or delegated to you.</p>
          {servers.ok && serverItems.length > 0 ? (
            <>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="subjectType">Subject type</label>
                  <select id="subjectType" name="subjectType" required>
                    <option value="team">Team</option>
                    <option value="user">User</option>
                    <option value="service_account">Service account</option>
                  </select>
                  <p className="field__hint">Grant to the smallest identity that needs the tools.</p>
                </div>
                <div className="field">
                  <label htmlFor="environment">Environment</label>
                  <select id="environment" name="environment" required>
                    <option value="dev">dev</option>
                    <option value="stg">stg</option>
                    <option value="prod">prod</option>
                    <option value="shared">shared</option>
                  </select>
                  <p className="field__hint">Use the environment where the grant should apply.</p>
                </div>
              </div>
              <div className="field"><label htmlFor="subjectId">Subject ID</label><input id="subjectId" name="subjectId" required placeholder="team-platform" /><p className="field__hint">User, team, or service account identifier receiving the grant.</p></div>
              <div className="field"><label htmlFor="grantProjectId">Project ID</label><input id="grantProjectId" name="projectId" required placeholder="project-console" /><p className="field__hint">Project used for audit and policy evaluation.</p></div>
              <div className="field">
                <label htmlFor="grantServerId">Server</label>
                <select id="grantServerId" name="serverId" required>
                  {serverItems.map((server) => <option value={server.id} key={server.id}>{server.displayName}</option>)}
                </select>
                <p className="field__hint">Server that owns the allowed tools.</p>
              </div>
              <div className="field"><label htmlFor="allowedTools">Allowed tools</label><input id="allowedTools" name="allowedTools" required placeholder="docs.search, docs.lookup" /><p className="field__hint">Comma-separated tool names. Avoid broad grants when one tool is enough.</p></div>
              <div className="field"><label htmlFor="grantReason">Reason</label><textarea id="grantReason" name="reason" required placeholder="Approved incident response access for release investigation." /><p className="field__hint">This reason appears with the grant for later review.</p></div>
              <details className="advanced-fields">
                <summary>Advanced grant fields</summary>
                <div className="field"><label htmlFor="ticketUrl">Ticket URL</label><input id="ticketUrl" name="ticketUrl" type="url" placeholder="https://tickets.example.test/MCP-123" /></div>
                <div className="field"><label htmlFor="expiresAt">Expires at</label><input id="expiresAt" name="expiresAt" placeholder="2026-06-08T10:00:00Z" /><p className="field__hint">Use an ISO timestamp for temporary grants.</p></div>
              </details>
              <div className="submission-summary" aria-label="Grant summary">
                <strong>Before creating</strong>
                <ul>
                  <li>Subject, project, server, environment, and tools match the approved access.</li>
                  <li>Reason and ticket create a review trail.</li>
                  <li>Expiry is set for temporary or incident-only access.</li>
                </ul>
              </div>
              <div className="form-actions"><button className="button" type="submit">Create grant</button></div>
            </>
          ) : servers.ok ? <EmptyState title="No data yet" description="Register a server before creating grants." /> : <ErrorState message={servers.error} />}
        </form> : null}
      </div>
    </div>
  );
}

function GrantControls(grant: ApiGrant) {
  return (
    <form action={revokeGrantAction}>
      <input type="hidden" name="grantId" value={grant.id} />
      <button className="button button--danger" type="submit" disabled={!grant.enabled}>{grant.enabled ? "Revoke grant" : "Revoked"}</button>
    </form>
  );
}
