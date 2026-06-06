import Link from "next/link";
import { EmptyState, StatusPill, Surface } from "@mcp-hub/ui";

import { disableServerAction, disableToolAction, enableServerAction, enableToolAction } from "../../actions";
import { PageHero, SectionHeader } from "../../../components/chrome";
import { enabledTone, formatDate, healthTone, riskTone } from "../../../components/format";
import { ErrorState } from "../../../components/states";
import { AuditTable, ServerVersionTable, ToolTable } from "../../../components/tables";
import type { ApiMcpServerVersion, ApiMcpTool } from "../../../lib/api";
import { getServer, listAuditEvents, listServerHealth, listServerVersions, listTools } from "../../../lib/api";
import { loadResult } from "../../../lib/result";
import { selectActiveServerVersion, selectRecentServerAuditEvents, selectServerHealth } from "./page-helpers";

type ServerDetailPageProps = Readonly<{
  params: Promise<{ serverId: string }>;
}>;

export default async function ServerDetailPage({ params }: ServerDetailPageProps) {
  const { serverId } = await params;
  const serverPromise = loadResult(getServer(serverId));
  const toolsPromise = loadResult(listTools(serverId));
  const healthPromise = loadResult(listServerHealth());
  const auditPromise = loadResult(listAuditEvents({ limit: 50, server: serverId }));
  const versionsPromise = loadResult(listServerVersions(serverId));
  const [server, tools, health, audit, versions] = await Promise.all([serverPromise, toolsPromise, healthPromise, auditPromise, versionsPromise]);

  if (!server.ok) {
    return (
      <div className="page-stack">
        <PageHero eyebrow="Server detail" title="Server unavailable." description="The Control Plane could not return this MCP server." />
        <ErrorState message={server.error} />
        <Link className="button" href="/catalog">Back to catalog</Link>
      </div>
    );
  }

  const latestHealth = health.ok ? selectServerHealth(health.data.items, serverId) : undefined;
  const recentAudit = audit.ok ? selectRecentServerAuditEvents(audit.data.items) : [];
  const versionItems = versions.ok ? versions.data.items : [];
  const activeVersion = versions.ok ? selectActiveServerVersion(versionItems) : undefined;

  return (
    <div className="page-stack">
      <PageHero eyebrow={server.data.slug} title={server.data.displayName} description={server.data.description ?? "No server description published."} />
      <div className="detail-grid">
        <Surface>
          <SectionHeader title="Server profile" description="Control Plane metadata for this MCP server." />
          <div className="grid">
            <p><strong>Server ID:</strong> {server.data.id}</p>
            <p><strong>Owner team:</strong> {server.data.ownerTeamId}</p>
            <p><strong>Environment:</strong> {server.data.environment}</p>
            <p><strong>Transport:</strong> {server.data.transport}</p>
            <p><strong>Upstream URL:</strong> {server.data.upstreamUrl ?? "Unavailable from Control Plane API"}</p>
            <p><strong>Schema version:</strong> {server.data.schemaVersion ?? "Unavailable from Control Plane API"}</p>
            <p><strong>Created:</strong> {formatDate(server.data.createdAt)}</p>
            <p><strong>Updated:</strong> {formatDate(server.data.updatedAt)}</p>
          </div>
        </Surface>
        <Surface className="panel--accent">
          <SectionHeader title="Risk and controls" description="Enable or disable this server through existing Control Plane endpoints." />
          <div className="grid">
            <div className="actions">
              <StatusPill tone={riskTone(server.data.riskLevel)}>{server.data.riskLevel}</StatusPill>
              <StatusPill tone={enabledTone(server.data.enabled)}>{server.data.enabled ? "enabled" : "disabled"}</StatusPill>
              {latestHealth ? <StatusPill tone={healthTone(latestHealth.status)}>{latestHealth.status}</StatusPill> : <StatusPill>health unavailable</StatusPill>}
            </div>
            {latestHealth ? <p className="muted">Latest health check: {formatDate(latestHealth.checkedAt)}{latestHealth.errorMessage ? ` · ${latestHealth.errorMessage}` : ""}</p> : <p className="muted">No /api/server-health row was returned for this server.</p>}
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
        <SectionHeader title="Server versions" description="Read-only release state from /api/servers/:serverId/versions." />
        {versions.ok && activeVersion ? (
          <div className="grid">
            <ActiveVersionSummary version={activeVersion} />
            <ServerVersionTable versions={versionItems} />
          </div>
        ) : versions.ok ? <EmptyState title="No server versions" description="The Control Plane returned no versions for this server." /> : <ErrorState title="Server versions unavailable" message={versions.error} />}
      </section>
      <section>
        <SectionHeader title="Recent audit event" description="Most recent event for this server from /api/audit-events." />
        {audit.ok && recentAudit.length > 0 ? <AuditTable events={recentAudit} /> : audit.ok ? <EmptyState title="No server audit event" description="No audit event in the fetched window references this server." /> : <ErrorState message={audit.error} />}
      </section>
      <section>
        <SectionHeader title="Server tools" description="Tools discovered for this server via /api/servers/:serverId/tools, including schema visibility and tool enablement controls." />
        {tools.ok && tools.data.items.length > 0 ? <ToolTable tools={tools.data.items} showSchema actionSlot={ToolControls} /> : tools.ok ? <EmptyState title="No tools discovered" description="The server exists, but no tools were returned by the Control Plane." /> : <ErrorState message={tools.error} />}
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
