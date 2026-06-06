export const requiredEnvKeys = [
  "NODE_ENV",
  "DATABASE_URL",
  "REDIS_URL",
  "OIDC_ISSUER_URL",
  "OIDC_AUDIENCE",
  "OIDC_CLIENT_ID",
  "OIDC_CLIENT_SECRET",
  "MCP_HUB_PUBLIC_URL",
  "MCP_API_URL",
  "MCP_GATEWAY_URL",
  "LOG_LEVEL"
] as const;

export type ConfigKey = (typeof requiredEnvKeys)[number];

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  return Object.fromEntries(requiredEnvKeys.map((key) => [key, env[key]])) as Record<
    ConfigKey,
    string | undefined
  >;
}
