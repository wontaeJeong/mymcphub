import Link from "next/link";
import { EmptyState, StatusPill, Surface } from "@mcp-hub/ui";

import { disableServerAction, disableToolAction, enableServerAction, enableToolAction } from "../../actions";
import { PageHero, SectionHeader } from "../../../components/chrome";
import { enabledTone, formatDate, healthTone, riskTone } from "../../../components/format";
import { ErrorState } from "../../../components/states";
import { AuditTable, ServerVersionTable, ToolTable } from "../../../components/tables";
import type { ApiMcpServerVersion, ApiMcpTool } from "../../../lib/api";
import { getServer, listAuditEvents, listGrants, listServerHealth, listServerVersions, listTools } from "../../../lib/api";
import { loadResult } from "../../../lib/result";
import { buildGrantStatus } from "../../tools/page-helpers";
import { selectActiveServerVersion, selectRecentServerAuditEvents, selectServerHealth } from "./page-helpers";

type ServerDetailPageProps = Readonly<{
  params: Promise<{ serverId: string }>;
}>;

export async function AdminServerDetailPageContent({ params }: ServerDetailPageProps) {
  const { serverId } = await params;
  const serverPromise = loadResult(getServer(serverId));
  const toolsPromise = loadResult(listTools(serverId));
  const healthPromise = loadResult(listServerHealth());
  const auditPromise = loadResult(listAuditEvents({ limit: 50, server: serverId }));
  const versionsPromise = loadResult(listServerVersions(serverId));
  const grantsPromise = loadResult(listGrants());
  const [server, tools, health, audit, versions, grants] = await Promise.all([serverPromise, toolsPromise, healthPromise, auditPromise, versionsPromise, grantsPromise]);

  if (!server.ok) {
    return (
      <div className="page-stack">
        <PageHero eyebrow="Server detail" title="Server unavailable." description="Backend data for this MCP server is unavailable." />
        <ErrorState message={server.error} />
        <Link className="button" href="/admin/servers">Back to catalog</Link>
      </div>
    );
  }

  const latestHealth = health.ok ? selectServerHealth(health.data.items, serverId) : undefined;
  const recentAudit = audit.ok ? selectRecentServerAuditEvents(audit.data.items) : [];
  const versionItems = versions.ok ? versions.data.items : [];
  const activeVersion = versions.ok ? selectActiveServerVersion(versionItems) : undefined;
  const toolItems = tools.ok ? tools.data.items : [];
  const grantStatusByToolKey = buildGrantStatus(toolItems, grants.ok ? grants.data.items : []);

  return (
    <div className="page-stack">
      <PageHero eyebrow={server.data.slug} title={server.data.displayName} description={server.data.description ?? "No server description published."} />
      <div className="detail-grid">
        <Surface>
          <SectionHeader title="Server profile" description="Ownership, environment, transport, and lifecycle details for this server." />
          <div className="grid">
            <p><strong>Server ID:</strong> {server.data.id}</p>
            <p><strong>Owner team:</strong> {server.data.ownerTeamId}</p>
            <p><strong>Environment:</strong> {server.data.environment}</p>
            <p><strong>Transport:</strong> {server.data.transport}</p>
            <p><strong>Upstream URL:</strong> {server.data.upstreamUrl ?? "Unavailable from backend"}</p>
            <p><strong>Schema version:</strong> {server.data.schemaVersion ?? "Unavailable from backend"}</p>
            <p><strong>Created:</strong> {formatDate(server.data.createdAt)}</p>
            <p><strong>Updated:</strong> {formatDate(server.data.updatedAt)}</p>
          </div>
        </Surface>
        <Surface className="panel--accent">
          <SectionHeader title="Risk and controls" description="Enable or disable this server after reviewing risk and latest health." />
          <div className="grid">
            <div className="actions">
              <StatusPill tone={riskTone(server.data.riskLevel)}>{server.data.riskLevel}</StatusPill>
              <StatusPill tone={enabledTone(server.data.enabled)}>{server.data.enabled ? "enabled" : "disabled"}</StatusPill>
              {latestHealth ? <StatusPill tone={healthTone(latestHealth.status)}>{latestHealth.status}</StatusPill> : <StatusPill>health unavailable</StatusPill>}
            </div>
            {latestHealth ? <p className="muted">Latest health check: {formatDate(latestHealth.checkedAt)}{latestHealth.errorMessage ? ` · ${latestHealth.errorMessage}` : ""}</p> : <p className="muted">No health check has been recorded for this server yet.</p>}
            <div className="actions">
              <form action={enableServerAction}>
                <input type="hidden" name="serverId" value={server.data.id} />
                <button className="button" type="submit" disabled={server.data.enabled}>Enable server</button>
              </form>
              <form action={disableServerAction}>
                <input type="hidden" name="serverId" value={server.data.id} />
                <button className="button button--danger" type="submit" disabled={!server.data.enabled}>Disable server</button>
              </form>
            </div>
          </div>
        </Surface>
      </div>
      <section>
        <SectionHeader title="Server versions" description="Read-only release state and active version selection." />
        {versions.ok && activeVersion ? (
          <div className="grid">
            <ActiveVersionSummary version={activeVersion} />
            <ServerVersionTable versions={versionItems} />
          </div>
        ) : versions.ok ? <EmptyState title="No data yet" description="No versions have been recorded for this server." /> : <ErrorState title="Server versions unavailable" message={versions.error} />}
      </section>
      <section>
        <SectionHeader title="Recent audit event" description="Most recent event for this server in the loaded audit window." />
        {audit.ok && recentAudit.length > 0 ? <AuditTable events={recentAudit} /> : audit.ok ? <EmptyState title="No server audit event" description="No audit event in the fetched window references this server." /> : <ErrorState message={audit.error} />}
      </section>
      {!grants.ok ? <ErrorState title="Grant status unavailable" message={grants.error} /> : null}
      <section className="capability-section">
        <SectionHeader title="Tools, resources, and prompts" description="Tools are live when available. Resources and prompts are clearly marked when unsupported by this backend." />
        <div className="capability-tabs" role="tablist" aria-label="Server capabilities">
          <a className="capability-tab" href="#server-tools" role="tab" aria-selected="true">Tools</a>
          <a className="capability-tab" href="#server-resources" role="tab" aria-selected="false">Resources</a>
          <a className="capability-tab" href="#server-prompts" role="tab" aria-selected="false">Prompts</a>
        </div>
        <div className="grid capability-panels">
          <div id="server-tools">
          <Surface className="capability-panel">
            <SectionHeader title="Server tools" description="Discovered tools with schema visibility, grant status, risk, and enablement controls." />
            {tools.ok && toolItems.length > 0 ? <ToolTable tools={toolItems} grantStatusByToolKey={grantStatusByToolKey} showSchema showAccess actionSlot={ToolControls} /> : tools.ok ? <EmptyState title="No data yet" description="The server exists, but no tools have been discovered yet." /> : <ErrorState message={tools.error} />}
          </Surface>
          </div>
          <div id="server-resources">
          <Surface className="capability-panel">
            <SectionHeader title="Resources" description="Feature not supported by this backend yet." />
            <EmptyState title="Unsupported by current backend" description="Resources are not listed until the backend exposes a resources contract." />
          </Surface>
          </div>
          <div id="server-prompts">
          <Surface className="capability-panel">
            <SectionHeader title="Prompts" description="Feature not supported by this backend yet." />
            <EmptyState title="Unsupported by current backend" description="Prompts are not listed until the backend exposes a prompts contract." />
          </Surface>
          </div>
        </div>
      </section>
    </div>
  );
}

function ActiveVersionSummary({ version }: Readonly<{ version: ApiMcpServerVersion }>) {
  return (
    <Surface>
      <SectionHeader title="Active version" description="Current server version selected from active status or newest available fallback." />
      <div className="grid">
        <div className="actions">
          <StatusPill tone={version.status === "active" ? "success" : "warning"}>{version.status}</StatusPill>
          <StatusPill>{version.version}</StatusPill>
        </div>
        <p><strong>Image:</strong> {formatVersionImage(version)}</p>
        <p><strong>Config hash:</strong> {version.configHash ?? "Not recorded"}</p>
        <p><strong>Tool schema hash:</strong> {version.toolSchemaHash ?? "Not recorded"}</p>
        <p><strong>Created:</strong> {formatDate(version.createdAt)}</p>
        <p><strong>Activated:</strong> {formatDate(version.activatedAt)}</p>
      </div>
    </Surface>
  );
}

function formatVersionImage(version: ApiMcpServerVersion) {
  if (version.imageRef) {
    return version.imageRef;
  }

  if (version.imageRepository && version.imageTag) {
    return `${version.imageRepository}:${version.imageTag}`;
  }

  return version.imageRepository ?? version.imageDigest ?? "Image not recorded";
}

function ToolControls(tool: ApiMcpTool) {
  return (
    <div className="actions">
      <form action={enableToolAction}>
        <input type="hidden" name="serverId" value={tool.serverId} />
        <input type="hidden" name="toolId" value={tool.id} />
        <button className="button" type="submit" disabled={tool.enabled}>Enable</button>
      </form>
      <form action={disableToolAction}>
        <input type="hidden" name="serverId" value={tool.serverId} />
        <input type="hidden" name="toolId" value={tool.id} />
        <button className="button button--danger" type="submit" disabled={!tool.enabled}>Disable</button>
      </form>
    </div>
  );
}
