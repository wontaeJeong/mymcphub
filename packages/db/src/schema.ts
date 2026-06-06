export const dbTableNames = [
  "users",
  "teams",
  "team_memberships",
  "projects",
  "project_memberships",
  "mcp_servers",
  "mcp_server_versions",
  "mcp_tools",
  "mcp_tool_schemas",
  "mcp_grants",
  "approval_requests",
  "oauth_clients",
  "mcp_sessions",
  "audit_events",
  "tool_call_events",
  "server_health_checks",
  "secret_refs",
  "policy_versions"
] as const;

export type DbTableName = (typeof dbTableNames)[number];

export type DatabaseConfig = {
  databaseUrl: string;
};
