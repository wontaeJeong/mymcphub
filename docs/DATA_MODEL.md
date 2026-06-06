# Data Model

MCP Hub separates identity, catalog, authorization, runtime session, audit, and operations data.

## Identity and Ownership

- `users` stores authenticated human users.
- `teams` stores owner groups.
- `team_memberships` connects users to teams.
- `projects` groups MCP access by application or workspace.
- `project_memberships` grants users, teams, or service accounts project roles.

## MCP Catalog

- `mcp_servers` is the server catalog source of truth with slug, owner team, environment, transport, upstream URL, enabled flag, and risk level.
- `mcp_server_versions` stores versioned release metadata, including image repository/tag/digest, config and tool-schema hashes, lifecycle status, creator, activation timestamp, and compatibility manifest/image reference fields.
- `mcp_tools` stores discovered tool names and risk metadata per server.
- `mcp_tool_schemas` snapshots input/output schemas by hash and version.

## Authorization and Approval

- `mcp_grants` stores user/team/service-account access to server tools by project and environment.
- `approval_requests` stores requested access or sensitive-tool actions before they become grants.
- `policy_versions` stores versioned policy documents so gateway decisions can be traced to a policy version.

## Runtime and Audit

- `oauth_clients` identifies clients that can initiate MCP sessions.
- `mcp_sessions` maps gateway sessions to optional user, team, project, and client context.
- `audit_events` is the audit source of truth for policy decisions, trace IDs, latency, upstream status, argument hashes, and redacted metadata.
- `tool_call_events` records tool-call level status linked to audit events.
- `server_health_checks` stores worker health observations.
- `secret_refs` stores references to external secret providers without storing secret values.

## Shared Schemas

Runtime validation schemas live in `packages/db/src/validation.ts`. The required shared schemas are `McpServerManifestSchema`, `McpToolSchema`, `McpGrantSchema`, `PolicyDecisionInputSchema`, `PolicyDecisionResultSchema`, `AuditEventSchema`, and `HealthCheckResultSchema`.

The local seed data includes `stdio-sample` with transport `stdio_adapter` and upstream URL `http://localhost:5103/mcp`. This records the adapter HTTP endpoint in catalog data while keeping the stdio command and child-process configuration in the adapter deployment environment.
