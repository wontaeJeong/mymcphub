export type DatabaseConfig = {
  databaseUrl: string;
};

export const databasePackage = {
  name: "@mcp-hub/db",
  purpose: "Database schema, migrations, and repositories will be implemented here."
} as const;
