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
      <PageHero eyebrow="Access requests and grants" title="Permission paths without guesswork." description={mode === "admin" ? "Review grants, create grants, and revoke grants against real Control Plane endpoints." : "Review your visible grants and submit approval requests. Grant creation and revocation stay in admin-only workflows."} />
      <section>
        <SectionHeader title="Current grants" description="Data from /api/grants, joined locally with the server catalog when available." />
        {grants.ok && visibleGrants.length > 0 ? <GrantTable grants={visibleGrants} serverNameById={serverNameById} actionSlot={mode === "admin" ? GrantControls : undefined} /> : grants.ok ? <EmptyState title="No grants" description={mode === "user" ? "No grants matched your user or team identifiers." : "The Control Plane returned no grants."} /> : <ErrorState message={grants.error} />}
      </section>
      <div className={mode === "admin" ? "form-grid" : "grid"}>
        <form className="form-card" action={createApprovalAction}>
          <h2>Request Access Approval</h2>
          <p>Create a pending approval request via /api/approvals with subject, tools, environment, ticket, expiry, and reason sent as first-class fields.</p>
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
                </div>
                <div className="field">
                  <label htmlFor="approvalEnvironment">Environment</label>
                  <select id="approvalEnvironment" name="environment" required>
                    <option value="dev">dev</option>
                    <option value="stg">stg</option>
                    <option value="prod">prod</option>
                    <option value="shared">shared</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="approvalSubjectId">Subject ID</label>
                <input id="approvalSubjectId" name="subjectId" required defaultValue={mode === "user" ? session?.principal.userId : undefined} readOnly={mode === "user"} placeholder="User, team, or service account UUID" />
              </div>
              <div className="field">
                <label htmlFor="approvalServerId">Server</label>
                <select id="approvalServerId" name="serverId" required>
                  {serverItems.map((server) => <option value={server.id} key={server.id}>{server.displayName}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="approvalProjectId">Project ID</label>
                <input id="approvalProjectId" name="projectId" required defaultValue={mode === "user" ? session?.principal.projectId : undefined} readOnly={mode === "user"} placeholder="UUID from your project record" />
              </div>
              <div className="field">
                <label htmlFor="approvalRequestedTools">Requested tools</label>
                <input id="approvalRequestedTools" name="requestedTools" required placeholder="Single tool or comma-separated tools" />
              </div>
              <div className="field">
                <label htmlFor="requestedAction">Requested action</label>
                <input id="requestedAction" name="requestedAction" required defaultValue="grant_access" />
              </div>
              <div className="field">
                <label htmlFor="approvalTicketUrl">Ticket URL</label>
                <input id="approvalTicketUrl" name="ticketUrl" type="url" placeholder="Optional approval ticket" />
              </div>
              <div className="field">
                <label htmlFor="approvalRequestedExpiresAt">Requested expiry</label>
                <input id="approvalRequestedExpiresAt" name="requestedExpiresAt" placeholder="Optional ISO timestamp" />
              </div>
              <div className="field">
                <label htmlFor="approvalReason">Reason</label>
                <textarea id="approvalReason" name="reason" required placeholder="Business justification" />
              </div>
              <div className="form-actions"><button className="button" type="submit">Submit approval</button></div>
            </>
          ) : servers.ok ? <EmptyState title="No servers available" description="Approval requests require a server from the catalog." /> : <ErrorState message={servers.error} />}
        </form>
        {mode === "admin" ? <form className="form-card" action={createGrantAction}>
          <h2>Create Grant</h2>
          <p>Create an access grant via /api/grants when you already have approval authority.</p>
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
                </div>
                <div className="field">
                  <label htmlFor="environment">Environment</label>
                  <select id="environment" name="environment" required>
                    <option value="dev">dev</option>
                    <option value="stg">stg</option>
                    <option value="prod">prod</option>
                    <option value="shared">shared</option>
                  </select>
                </div>
              </div>
              <div className="field"><label htmlFor="subjectId">Subject ID</label><input id="subjectId" name="subjectId" required /></div>
              <div className="field"><label htmlFor="grantProjectId">Project ID</label><input id="grantProjectId" name="projectId" required placeholder="UUID from your project record" /></div>
              <div className="field">
                <label htmlFor="grantServerId">Server</label>
                <select id="grantServerId" name="serverId" required>
                  {serverItems.map((server) => <option value={server.id} key={server.id}>{server.displayName}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor="allowedTools">Allowed tools</label><input id="allowedTools" name="allowedTools" required placeholder="Comma-separated tool names" /></div>
              <div className="field"><label htmlFor="ticketUrl">Ticket URL</label><input id="ticketUrl" name="ticketUrl" type="url" placeholder="Optional approval ticket" /></div>
              <div className="field"><label htmlFor="expiresAt">Expires at</label><input id="expiresAt" name="expiresAt" placeholder="Optional ISO timestamp" /></div>
              <div className="field"><label htmlFor="grantReason">Reason</label><textarea id="grantReason" name="reason" required /></div>
              <div className="form-actions"><button className="button" type="submit">Create grant</button></div>
            </>
          ) : servers.ok ? <EmptyState title="No servers available" description="Grant creation requires a server from the catalog." /> : <ErrorState message={servers.error} />}
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
