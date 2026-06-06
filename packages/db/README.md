# Database Package

`@mcp-hub/db` owns the Control Plane data model, PostgreSQL migration runner, seed command, shared domain types, Zod validation schemas, and minimal repository helpers.

## Tables

The initial migration creates `users`, `teams`, `team_memberships`, `projects`, `project_memberships`, `mcp_servers`, `mcp_server_versions`, `mcp_tools`, `mcp_tool_schemas`, `mcp_grants`, `approval_requests`, `oauth_clients`, `mcp_sessions`, `audit_events`, `tool_call_events`, `server_health_checks`, `secret_refs`, and `policy_versions`.

## Commands

- `pnpm --filter @mcp-hub/db migrate` runs SQL migrations against `DATABASE_URL`.
- `pnpm --filter @mcp-hub/db migrate:dry-run` lists migrations without connecting to PostgreSQL.
- `pnpm --filter @mcp-hub/db seed` inserts local seed data against `DATABASE_URL`.
- `pnpm --filter @mcp-hub/db seed:dry-run` validates that seed statements are available without connecting to PostgreSQL.

## Seed Data

The seed command includes an admin user, platform team, sample project, echo MCP server, internal-docs MCP server, k8s-readonly MCP server, stdio-sample adapter-backed MCP server, and sample platform-team grants for echo and stdio-sample tools.
