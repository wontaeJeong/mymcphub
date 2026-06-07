import Link from "next/link";
import type { ReactNode } from "react";
import { StatusPill } from "@mcp-hub/ui";

import { CopyButton } from "./copy-button";
import type {
  ApiApproval,
  ApiAuditEvent,
  ApiGrant,
  ApiMcpServer,
  ApiMcpServerVersion,
  ApiMcpTool,
  ApiServerHealth,
  ApiToolCallEvent,
  ServerVersionStatus,
} from "../lib/api";
import {
  approvalTone,
  enabledTone,
  formatDate,
  healthTone,
  policyTone,
  riskTone,
} from "./format";

export type ServerTableProps = Readonly<{
  servers: ApiMcpServer[];
  healthByServerId?: Map<string, ApiServerHealth>;
  serverBasePath?: string;
}>;

export function ServerTable({ servers, healthByServerId, serverBasePath = "/user/servers" }: ServerTableProps) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Server</th>
            <th>Environment</th>
            <th>Risk</th>
            <th>Health</th>
            <th>State</th>
            <th>Ops</th>
            <th>Last updated</th>
          </tr>
        </thead>
        <tbody>
          {servers.map((server) => {
            const health = healthByServerId?.get(server.id);
            return (
              <tr key={server.id}>
                <td>
                  <Link href={`${serverBasePath}/${server.id}`}>
                    {server.displayName}
                  </Link>
                  <p className="muted">
                    {server.description ?? "No description published."}
                  </p>
                  <p className="muted">
                    {server.slug} · Owner {server.ownerTeamId} · {server.transport}
                  </p>
                </td>
                <td>{server.environment}</td>
                <td>
                  <StatusPill tone={riskTone(server.riskLevel)}>
                    {server.riskLevel}
                  </StatusPill>
                </td>
                <td>
                  {health ? (
                    <StatusPill tone={healthTone(health.status)}>
                      {health.status}
                    </StatusPill>
                  ) : (
                    <StatusPill>unavailable</StatusPill>
                  )}
                </td>
                <td>
                  <StatusPill tone={enabledTone(server.enabled)}>
                    {server.enabled ? "enabled" : "disabled"}
                  </StatusPill>
                </td>
                <td>
                  <div className="actions">
                    <StatusPill
                      tone={
                        server.published
                          ? "success"
                          : server.published === false
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {server.published
                        ? "published"
                        : server.published === false
                          ? "unpublished"
                          : "publication n/a"}
                    </StatusPill>
                    <StatusPill tone={server.quarantined ? "danger" : "neutral"}>
                      {server.quarantined ? "quarantined" : "not quarantined"}
                    </StatusPill>
                  </div>
                </td>
                <td>{formatDate(server.updatedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export type ToolTableProps = Readonly<{
  tools: ApiMcpTool[];
  grantStatusByToolKey?: Map<string, string>;
  showSchema?: boolean;
  showAccess?: boolean;
  showAdminPlaceholder?: boolean;
  actionSlot?: (tool: ApiMcpTool) => ReactNode;
}>;

export function ToolTable({
  tools,
  grantStatusByToolKey,
  showSchema = false,
  showAccess = false,
  showAdminPlaceholder = false,
  actionSlot,
}: ToolTableProps) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tool</th>
            <th>Risk</th>
            <th>Status</th>
            {showSchema ? <th>Input schema</th> : null}
            {showAccess ? <th>Access</th> : null}
            <th>Discovered</th>
            <th>Last seen</th>
            {showAdminPlaceholder ? <th>Admin test</th> : null}
            {actionSlot ? <th>Controls</th> : null}
          </tr>
        </thead>
        <tbody>
          {tools.map((tool) => (
            <tr key={tool.id}>
              <td>
                {tool.name}
                <p className="muted">
                  {tool.description ??
                    "No description published by the server."}
                </p>
              </td>
              <td>
                <StatusPill tone={riskTone(tool.riskLevel)}>
                  {tool.riskLevel}
                </StatusPill>
              </td>
              <td>
                <StatusPill tone={enabledTone(tool.enabled)}>
                  {tool.enabled ? "enabled" : "disabled"}
                </StatusPill>
              </td>
              {showSchema ? (
                <td>
                  <SchemaViewer tool={tool} />
                </td>
              ) : null}
              {showAccess ? (
                <td>
                  {grantStatusByToolKey?.get(toolKey(tool)) ??
                    "No active grant found"}
                </td>
              ) : null}
              <td>{formatDate(tool.discoveredAt)}</td>
              <td>{formatDate(tool.lastSeenAt)}</td>
              {showAdminPlaceholder ? (
                <td>
                  <StatusPill tone="info">Unsupported</StatusPill>
                  <p className="muted">
                    Use policy dry-run for safe testing; live admin test calls are not supported by this backend yet.
                  </p>
                </td>
              ) : null}
              {actionSlot ? <td>{actionSlot(tool)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ServerVersionTable({
  versions,
}: Readonly<{ versions: ApiMcpServerVersion[] }>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Version</th>
            <th>Status</th>
            <th>Image</th>
            <th>Hashes</th>
            <th>Created</th>
            <th>Activated</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((version) => (
            <tr key={version.id}>
              <td>
                {version.version}
                <p className="muted">
                  {version.createdBy
                    ? `Created by ${version.createdBy}`
                    : "Creator not recorded"}
                </p>
              </td>
              <td>
                <StatusPill tone={serverVersionTone(version.status)}>
                  {version.status}
                </StatusPill>
              </td>
              <td>
                <VersionImage version={version} />
              </td>
              <td>
                <p>{version.configHash ?? "Config hash not recorded"}</p>
                <p className="muted">
                  Schema {version.toolSchemaHash ?? "not recorded"}
                </p>
              </td>
              <td>{formatDate(version.createdAt)}</td>
              <td>{formatDate(version.activatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type RolloutStatusRow = Readonly<{
  server: ApiMcpServer;
  activeVersion?: ApiMcpServerVersion;
  latestVersion?: ApiMcpServerVersion;
  health?: ApiServerHealth;
}>;

export function RolloutStatusTable({ rows, serverBasePath = "/admin/servers" }: Readonly<{ rows: RolloutStatusRow[]; serverBasePath?: string }>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Server</th>
            <th>Active version</th>
            <th>Latest rollout</th>
            <th>Health</th>
            <th>Quarantine</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.server.id}>
              <td>
                <Link href={`${serverBasePath}/${row.server.id}`}>{row.server.displayName}</Link>
                <p className="muted">{row.server.slug} · {row.server.environment}</p>
              </td>
              <td>{row.activeVersion ? <StatusPill tone="success">{row.activeVersion.version}</StatusPill> : <span className="muted">No active version</span>}</td>
              <td>{row.latestVersion ? <StatusPill tone={serverVersionTone(row.latestVersion.status)}>{row.latestVersion.status}</StatusPill> : <span className="muted">No rollout record</span>}</td>
              <td>{row.health ? <StatusPill tone={healthTone(row.health.status)}>{row.health.status}</StatusPill> : <StatusPill>health unavailable</StatusPill>}</td>
              <td>
                <div className="actions">
                  <StatusPill tone={enabledTone(row.server.enabled)}>{row.server.enabled ? "enabled" : "disabled"}</StatusPill>
                  <StatusPill tone={row.server.quarantined ? "danger" : "neutral"}>{row.server.quarantined ? "quarantined" : "not quarantined"}</StatusPill>
                </div>
              </td>
              <td>{formatDate(row.server.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GrantTable({
  grants,
  serverNameById,
  actionSlot,
}: Readonly<{
  grants: ApiGrant[];
  serverNameById: Map<string, string>;
  actionSlot?: (grant: ApiGrant) => ReactNode;
}>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Access</th>
            <th>Tools</th>
            <th>Status</th>
            <th>Reason</th>
            {actionSlot ? <th>Controls</th> : null}
          </tr>
        </thead>
        <tbody>
          {grants.map((grant) => (
            <tr key={grant.id}>
              <td>
                {grant.subjectType}: {grant.subjectId}
                <p className="muted">Project {grant.projectId}</p>
              </td>
              <td>{serverNameById.get(grant.serverId) ?? grant.serverId}<p className="muted">{grant.environment}</p></td>
              <td>{grant.allowedTools.join(", ")}</td>
              <td>
                <StatusPill tone={enabledTone(grant.enabled)}>
                  {grant.enabled ? "active" : "revoked"}
                </StatusPill>
              </td>
              <td>{grant.reason}</td>
              {actionSlot ? <td>{actionSlot(grant)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ApprovalTable({
  approvals,
  actionSlot,
}: Readonly<{
  approvals: ApiApproval[];
  actionSlot?: (approval: ApiApproval) => ReactNode;
}>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Scope</th>
            <th>Request</th>
            <th>Status</th>
            <th>Timing</th>
            <th>Decision</th>
          </tr>
        </thead>
        <tbody>
          {approvals.map((approval) => {
            const ticketUrl = safeExternalUrl(approval.ticketUrl);

            return (
              <tr key={approval.id}>
                <td>
                  {approval.subjectType}: {approval.subjectId}
                  <p className="muted">Requester {approval.requesterId}</p>
                </td>
                <td>
                  {approval.serverId}
                  <p className="muted">Project {approval.projectId}</p>
                </td>
                <td>
                  {approval.requestedAction}
                  <p className="muted">
                    {formatList(approval.requestedTools)} ·{" "}
                    {approval.environment}
                  </p>
                  {ticketUrl ? (
                    <p>
                      <a href={ticketUrl} target="_blank" rel="noreferrer">
                        Ticket
                      </a>
                    </p>
                  ) : null}
                  {approval.requestedExpiresAt ? (
                    <p className="muted">
                      Requested expiry {formatDate(approval.requestedExpiresAt)}
                    </p>
                  ) : null}
                  <p className="muted">{approval.reason}</p>
                </td>
                <td>
                  <StatusPill tone={approvalTone(approval.status)}>
                    {approval.status}
                  </StatusPill>
                </td>
                <td>
                  {formatDate(approval.createdAt)}
                  <p className="muted">
                    Updated {formatDate(approval.updatedAt)}
                  </p>
                </td>
                <td>
                  {actionSlot ? (
                    actionSlot(approval)
                  ) : (
                    <ApprovalDecision approval={approval} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VersionImage({ version }: Readonly<{ version: ApiMcpServerVersion }>) {
  if (version.imageRef) {
    return <span>{version.imageRef}</span>;
  }

  if (version.imageRepository || version.imageTag || version.imageDigest) {
    return (
      <div>
        <p>{version.imageRepository ?? "Image repository not recorded"}</p>
        <p className="muted">
          {version.imageTag ?? version.imageDigest ?? "Image tag not recorded"}
        </p>
      </div>
    );
  }

  return <span className="muted">Image not recorded</span>;
}

function serverVersionTone(status: ServerVersionStatus) {
  if (status === "active") {
    return "success";
  }

  if (status === "pending" || status === "draft") {
    return "warning";
  }

  if (status === "deprecated") {
    return "neutral";
  }

  return "danger";
}

function ApprovalDecision({ approval }: Readonly<{ approval: ApiApproval }>) {
  if (!approval.decidedAt && !approval.reviewerId && !approval.reviewComment) {
    return <span className="muted">Not decided</span>;
  }

  return (
    <div>
      {approval.reviewerId ? <p>Reviewer {approval.reviewerId}</p> : null}
      {approval.decidedAt ? (
        <p className="muted">Decided {formatDate(approval.decidedAt)}</p>
      ) : null}
      {approval.reviewComment ? (
        <p className="muted">{approval.reviewComment}</p>
      ) : null}
    </div>
  );
}

function formatList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "All requested tools";
}

function safeExternalUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? value
      : undefined;
  } catch (caught: unknown) {
    if (caught instanceof TypeError) {
      return undefined;
    }
    throw caught;
  }
}

export function AuditTable({ events, auditBasePath = "/admin/audit" }: Readonly<{ events: ApiAuditEvent[]; auditBasePath?: string }>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Policy</th>
            <th>Risk</th>
            <th>Actor</th>
            <th>Execution</th>
            <th>Argument hash</th>
            <th>Trace</th>
            <th>Redacted payload</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>
                {event.eventType}
                <p className="muted">
                  {event.toolName ?? event.serverId ?? "Hub scope"}
                </p>
              </td>
              <td>
                <StatusPill tone={policyTone(event.policyDecision)}>
                  {event.policyDecision}
                </StatusPill>
              </td>
              <td>
                <StatusPill tone={riskTone(event.riskLevel)}>
                  {event.riskLevel}
                </StatusPill>
              </td>
              <td>{event.userId ?? event.clientId ?? "unknown"}</td>
              <td>
                <AuditExecution event={event} />
              </td>
              <td>
                {event.argumentHash ? (
                  <code>{event.argumentHash}</code>
                ) : (
                  <span className="muted">Not recorded</span>
                )}
              </td>
              <td>
                <CopyButton value={event.traceId} label="Copy trace" />
                <Link
                  className="button button--ghost"
                  href={`${auditBasePath}?trace_id=${encodeURIComponent(event.traceId)}`}
                >
                  Trace link
                </Link>
              </td>
              <td>
                <RedactedJsonDetails
                  summary="View redacted arguments"
                  value={event.argumentRedactedJson}
                  emptyText="No redacted arguments returned"
                />
                <RedactedJsonDetails
                  summary="View redacted metadata"
                  value={event.metadataJson}
                  emptyText="No metadata returned"
                />
              </td>
              <td>{formatDate(event.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditExecution({ event }: Readonly<{ event: ApiAuditEvent }>) {
  return (
    <div>
      <p>
        {event.latencyMs === undefined ? (
          <span className="muted">Latency n/a</span>
        ) : (
          `${event.latencyMs} ms`
        )}
      </p>
      {event.upstreamStatus === undefined ? (
        <p className="muted">Upstream n/a</p>
      ) : (
        <StatusPill tone={event.upstreamStatus < 400 ? "success" : "warning"}>
          {event.upstreamStatus}
        </StatusPill>
      )}
      {event.errorCode ? (
        <p className="muted">Error {event.errorCode}</p>
      ) : null}
    </div>
  );
}

export function ToolCallTable({
  events,
  serverNameById,
}: Readonly<{
  events: ApiToolCallEvent[];
  serverNameById: Map<string, string>;
}>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tool</th>
            <th>Server</th>
            <th>Status</th>
            <th>Latency</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>{event.toolName}</td>
              <td>{serverNameById.get(event.serverId) ?? event.serverId}</td>
              <td>
                <StatusPill
                  tone={
                    isSuccessfulToolCallStatus(event.status)
                      ? "success"
                      : "warning"
                  }
                >
                  {event.status}
                </StatusPill>
              </td>
              <td>
                {event.latencyMs === undefined
                  ? "n/a"
                  : `${event.latencyMs} ms`}
              </td>
              <td>{formatDate(event.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HealthTable({
  checks,
  serverNameById,
}: Readonly<{
  checks: ApiServerHealth[];
  serverNameById: Map<string, string>;
}>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Server</th>
            <th>Status</th>
            <th>Latency</th>
            <th>Backoff</th>
            <th>Error</th>
            <th>Trace</th>
            <th>Checked</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={check.id}>
              <td>{serverNameById.get(check.serverId) ?? check.serverId}</td>
              <td>
                <StatusPill tone={healthTone(check.status)}>
                  {check.status}
                </StatusPill>
              </td>
              <td>
                {check.latencyMs === undefined
                  ? "n/a"
                  : `${check.latencyMs} ms`}
              </td>
              <td>
                {check.backoffSeconds
                  ? `${check.backoffSeconds}s after attempt ${check.attempt ?? 1}`
                  : "none"}
              </td>
              <td>{check.errorMessage ?? "None"}</td>
              <td>
                {check.traceId ? (
                  <CopyButton value={check.traceId} label="Copy trace" />
                ) : (
                  <span className="muted">n/a</span>
                )}
              </td>
              <td>{formatDate(check.checkedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SchemaViewer({ tool }: Readonly<{ tool: ApiMcpTool }>) {
  const schema = tool.inputSchema ?? tool.inputSchemaJson;
  if (schema === undefined) {
    return <span className="muted">Schema unavailable from backend</span>;
  }

  return (
    <details className="schema-viewer">
      <summary>View schema</summary>
      <pre className="code-block">{JSON.stringify(schema, null, 2)}</pre>
    </details>
  );
}

function RedactedJsonDetails({
  summary,
  value,
  emptyText,
}: Readonly<{ summary: string; value: unknown; emptyText: string }>) {
  if (value === undefined || value === null) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <details className="schema-viewer">
      <summary>{summary}</summary>
      <pre className="code-block">
        {JSON.stringify(redactAuditJson(value), null, 2)}
      </pre>
    </details>
  );
}

function redactAuditJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactAuditJson(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(
      ([key, nestedValue]) => [
        key,
        isSensitiveMetadataKey(key)
          ? "[REDACTED]"
          : redactAuditJson(nestedValue),
      ],
    ),
  );
}

function isSensitiveMetadataKey(key: string) {
  const normalized = key.toLowerCase();
  return (
    normalized.includes("token") ||
    normalized.includes("secret") ||
    normalized.includes("password") ||
    normalized.includes("authorization") ||
    normalized.includes("credential") ||
    normalized.endsWith("key")
  );
}

function toolKey(tool: ApiMcpTool) {
  return `${tool.serverId}:${tool.name}`;
}

function isSuccessfulToolCallStatus(status: string) {
  const normalized = status.toLowerCase();
  return (
    normalized === "ok" ||
    normalized === "success" ||
    normalized === "succeeded"
  );
}
