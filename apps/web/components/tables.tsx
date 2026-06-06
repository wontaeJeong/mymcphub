import Link from "next/link";
import type { ReactNode } from "react";
import { StatusPill } from "@mcp-hub/ui";

import { CopyButton } from "./copy-button";
import type { ApiApproval, ApiAuditEvent, ApiGrant, ApiMcpServer, ApiMcpTool, ApiServerHealth, ApiToolCallEvent } from "../lib/api";
import { approvalTone, enabledTone, formatDate, healthTone, policyTone, riskTone } from "./format";

export type ServerTableProps = Readonly<{
  servers: ApiMcpServer[];
  healthByServerId?: Map<string, ApiServerHealth>;
}>;

export function ServerTable({ servers, healthByServerId }: ServerTableProps) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Server</th>
            <th>Slug</th>
            <th>Owner team</th>
            <th>Environment</th>
            <th>Transport</th>
            <th>Risk</th>
            <th>Health</th>
            <th>Enabled</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {servers.map((server) => {
            const health = healthByServerId?.get(server.id);
            return (
              <tr key={server.id}>
                <td>
                  <Link href={`/servers/${server.id}`}>{server.displayName}</Link>
                  <p className="muted">{server.description ?? "No description published."}</p>
                </td>
                <td>{server.slug}</td>
                <td>{server.ownerTeamId}</td>
                <td>{server.environment}</td>
                <td>{server.transport}</td>
                <td><StatusPill tone={riskTone(server.riskLevel)}>{server.riskLevel}</StatusPill></td>
                <td>{health ? <StatusPill tone={healthTone(health.status)}>{health.status}</StatusPill> : <StatusPill>unavailable</StatusPill>}</td>
                <td><StatusPill tone={enabledTone(server.enabled)}>{server.enabled ? "enabled" : "disabled"}</StatusPill></td>
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

export function ToolTable({ tools, grantStatusByToolKey, showSchema = false, showAccess = false, showAdminPlaceholder = false, actionSlot }: ToolTableProps) {
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
                <p className="muted">{tool.description ?? "No description published by the server."}</p>
              </td>
              <td><StatusPill tone={riskTone(tool.riskLevel)}>{tool.riskLevel}</StatusPill></td>
              <td><StatusPill tone={enabledTone(tool.enabled)}>{tool.enabled ? "enabled" : "disabled"}</StatusPill></td>
              {showSchema ? <td><SchemaViewer tool={tool} /></td> : null}
              {showAccess ? <td>{grantStatusByToolKey?.get(toolKey(tool)) ?? "No active grant found"}</td> : null}
              <td>{formatDate(tool.discoveredAt)}</td>
              <td>{formatDate(tool.lastSeenAt)}</td>
              {showAdminPlaceholder ? <td><StatusPill tone="info">API pending</StatusPill><p className="muted">Admin test-call endpoint is not part of prompt 05.</p></td> : null}
              {actionSlot ? <td>{actionSlot(tool)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GrantTable({ grants, serverNameById, actionSlot }: Readonly<{ grants: ApiGrant[]; serverNameById: Map<string, string>; actionSlot?: (grant: ApiGrant) => ReactNode }>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Server</th>
            <th>Tools</th>
            <th>Environment</th>
            <th>Status</th>
            <th>Reason</th>
            {actionSlot ? <th>Controls</th> : null}
          </tr>
        </thead>
        <tbody>
          {grants.map((grant) => (
            <tr key={grant.id}>
              <td>{grant.subjectType}: {grant.subjectId}</td>
              <td>{serverNameById.get(grant.serverId) ?? grant.serverId}</td>
              <td>{grant.allowedTools.join(", ")}</td>
              <td>{grant.environment}</td>
              <td><StatusPill tone={enabledTone(grant.enabled)}>{grant.enabled ? "active" : "revoked"}</StatusPill></td>
              <td>{grant.reason}</td>
              {actionSlot ? <td>{actionSlot(grant)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ApprovalTable({ approvals, actionSlot }: Readonly<{ approvals: ApiApproval[]; actionSlot?: (approval: ApiApproval) => ReactNode }>) {
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
                  <p className="muted">{formatList(approval.requestedTools)} · {approval.environment}</p>
                  {ticketUrl ? <p><a href={ticketUrl} target="_blank" rel="noreferrer">Ticket</a></p> : null}
                  {approval.requestedExpiresAt ? <p className="muted">Requested expiry {formatDate(approval.requestedExpiresAt)}</p> : null}
                  <p className="muted">{approval.reason}</p>
                </td>
                <td><StatusPill tone={approvalTone(approval.status)}>{approval.status}</StatusPill></td>
                <td>
                  {formatDate(approval.createdAt)}
                  <p className="muted">Updated {formatDate(approval.updatedAt)}</p>
                </td>
                <td>{actionSlot ? actionSlot(approval) : <ApprovalDecision approval={approval} />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ApprovalDecision({ approval }: Readonly<{ approval: ApiApproval }>) {
  if (!approval.decidedAt && !approval.reviewerId && !approval.reviewComment) {
    return <span className="muted">Not decided</span>;
  }

  return (
    <div>
      {approval.reviewerId ? <p>Reviewer {approval.reviewerId}</p> : null}
      {approval.decidedAt ? <p className="muted">Decided {formatDate(approval.decidedAt)}</p> : null}
      {approval.reviewComment ? <p className="muted">{approval.reviewComment}</p> : null}
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
    return url.protocol === "http:" || url.protocol === "https:" ? value : undefined;
  } catch (caught: unknown) {
    if (caught instanceof TypeError) {
      return undefined;
    }
    throw caught;
  }
}

export function AuditTable({ events }: Readonly<{ events: ApiAuditEvent[] }>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Policy</th>
            <th>Risk</th>
            <th>Actor</th>
            <th>Trace</th>
            <th>Redacted metadata</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>{event.eventType}<p className="muted">{event.toolName ?? event.serverId ?? "Hub scope"}</p></td>
              <td><StatusPill tone={policyTone(event.policyDecision)}>{event.policyDecision}</StatusPill></td>
              <td><StatusPill tone={riskTone(event.riskLevel)}>{event.riskLevel}</StatusPill></td>
              <td>{event.userId ?? event.clientId ?? "unknown"}</td>
              <td><CopyButton value={event.traceId} label="Copy trace" /></td>
              <td><RedactedMetadata metadata={event.metadataJson} /></td>
              <td>{formatDate(event.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ToolCallTable({ events, serverNameById }: Readonly<{ events: ApiToolCallEvent[]; serverNameById: Map<string, string> }>) {
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
              <td><StatusPill tone={isSuccessfulToolCallStatus(event.status) ? "success" : "warning"}>{event.status}</StatusPill></td>
              <td>{event.latencyMs === undefined ? "n/a" : `${event.latencyMs} ms`}</td>
              <td>{formatDate(event.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HealthTable({ checks, serverNameById }: Readonly<{ checks: ApiServerHealth[]; serverNameById: Map<string, string> }>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Server</th>
            <th>Status</th>
            <th>Latency</th>
            <th>Error</th>
            <th>Checked</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={check.id}>
              <td>{serverNameById.get(check.serverId) ?? check.serverId}</td>
              <td><StatusPill tone={healthTone(check.status)}>{check.status}</StatusPill></td>
              <td>{check.latencyMs === undefined ? "n/a" : `${check.latencyMs} ms`}</td>
              <td>{check.errorMessage ?? "None"}</td>
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
    return <span className="muted">Unavailable from Control Plane API</span>;
  }

  return (
    <details className="schema-viewer">
      <summary>View schema</summary>
      <pre className="code-block">{JSON.stringify(schema, null, 2)}</pre>
    </details>
  );
}

function RedactedMetadata({ metadata }: Readonly<{ metadata: Record<string, unknown> }>) {
  return (
    <details className="schema-viewer">
      <summary>View redacted metadata</summary>
      <pre className="code-block">{JSON.stringify(redactMetadata(metadata), null, 2)}</pre>
    </details>
  );
}

function redactMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactMetadata(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      isSensitiveMetadataKey(key) ? "[redacted]" : redactMetadata(nestedValue)
    ])
  );
}

function isSensitiveMetadataKey(key: string) {
  const normalized = key.toLowerCase();
  return normalized.includes("token") || normalized.includes("secret") || normalized.includes("password") || normalized.includes("authorization") || normalized.includes("credential") || normalized.endsWith("key");
}

function toolKey(tool: ApiMcpTool) {
  return `${tool.serverId}:${tool.name}`;
}

function isSuccessfulToolCallStatus(status: string) {
  const normalized = status.toLowerCase();
  return normalized === "ok" || normalized === "success" || normalized === "succeeded";
}
