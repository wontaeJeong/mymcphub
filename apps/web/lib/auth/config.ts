import type { AuthContext } from "../api";

export type LoginProviderKind = "local" | "oidc" | "dev";

export type PublicLoginProvider = Readonly<{
  id: string;
  kind: LoginProviderKind;
  displayName: string;
}>;

export type LocalUserConfig = Readonly<{
  id: string;
  username: string;
  email: string;
  displayName: string;
  passwordHash: string;
  roles: string[];
  groups: string[];
  teams: string[];
}>;

export type OidcProviderConfig = Readonly<{
  id: string;
  displayName: string;
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  callbackUrl: string;
  endSessionUrl?: string;
  roleClaim: string;
  groupClaim: string;
  teamClaim: string;
  adminRoles: string[];
  adminGroups: string[];
  adminEmailDomains: string[];
  tokenEndpointAuthMethod: "client_secret_basic" | "client_secret_post";
}>;

export type WebAuthConfig = Readonly<{
  publicUrl: string;
  sessionCookieName: string;
  sessionTtlSeconds: number;
  localEnabled: boolean;
  devEnabled: boolean;
  localUsers: LocalUserConfig[];
  oidcProviders: OidcProviderConfig[];
  publicProviders: PublicLoginProvider[];
}>;

type Env = Record<string, string | undefined>;

const defaultSessionTtlSeconds = 28_800;

export function getWebAuthConfig(env: Env = process.env): WebAuthConfig {
  const publicUrl = readString(env, "MCP_HUB_PUBLIC_URL", "http://localhost:3000").replace(/\/$/, "");
  const explicitProviderIds = readCsv(env.MCP_WEB_AUTH_ENABLED_PROVIDERS);
  const localUsers = readLocalUsers(env);
  const localEnabled = isProviderEnabled("local", explicitProviderIds, env.MCP_WEB_LOCAL_AUTH_ENABLED === "true") && localUsers.length > 0;
  const oidcProviders = readOidcProviders(env, publicUrl, explicitProviderIds);
  const devDefault = env.NODE_ENV !== "production" && explicitProviderIds.length === 0 && env.MCP_WEB_DEV_AUTH_ENABLED !== "false";
  const devEnabled = isProviderEnabled("dev", explicitProviderIds, devDefault || env.MCP_WEB_DEV_AUTH_ENABLED === "true") && env.NODE_ENV !== "production";
  const publicProviders: PublicLoginProvider[] = [];

  if (localEnabled) {
    publicProviders.push({ id: "local", kind: "local", displayName: "Username and password" });
  }

  for (const provider of oidcProviders) {
    publicProviders.push({ id: provider.id, kind: "oidc", displayName: provider.displayName });
  }

  if (devEnabled) {
    publicProviders.push({ id: "dev", kind: "dev", displayName: "Development login" });
  }

  return {
    publicUrl,
    sessionCookieName: readString(env, "MCP_WEB_SESSION_COOKIE_NAME", env.MCP_SESSION_COOKIE_NAME ?? "mcp_hub_session"),
    sessionTtlSeconds: readPositiveInt(env.MCP_WEB_SESSION_TTL_SECONDS ?? env.MCP_SESSION_TTL_SECONDS, defaultSessionTtlSeconds),
    localEnabled,
    devEnabled,
    localUsers,
    oidcProviders,
    publicProviders,
  };
}

export function getPublicLoginProviders(env: Env = process.env) {
  return getWebAuthConfig(env).publicProviders;
}

export function findOidcProvider(providerId: string, env: Env = process.env) {
  return getWebAuthConfig(env).oidcProviders.find((provider) => provider.id === normalizeProviderId(providerId));
}

export function findLocalUser(username: string, env: Env = process.env) {
  const normalized = normalizeUsername(username);
  return getWebAuthConfig(env).localUsers.find((user) => normalizeUsername(user.username) === normalized);
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function localUserToPrincipal(user: LocalUserConfig): AuthContext {
  const roles = unique(user.roles);
  const groups = unique(user.groups);
  return {
    userId: user.id,
    principalType: "user",
    email: user.email,
    displayName: user.displayName,
    teamIds: user.teams,
    teams: user.teams,
    groups,
    roles,
    clientId: "mcp-hub-web-local",
    issuer: "local",
    audience: "mcp-hub-web",
    isAdmin: hasAdminRole(roles),
    isPlatformAdmin: hasPlatformAdmin(roles, groups),
    authSource: "local",
    tokenIssuer: "local",
    projectId: readString(process.env, "MCP_PROJECT_ID", "00000000-0000-4000-8000-000000000020"),
  };
}

export function devPrincipal(kind: "admin" | "user"): AuthContext {
  const roles = kind === "admin" ? ["platform_admin"] : ["reader"];
  const groups = kind === "admin" ? ["platform-admins"] : ["readonly"];
  return {
    userId: kind === "admin" ? "dev-admin" : "dev-user",
    principalType: "user",
    email: kind === "admin" ? "admin@example.com" : "user@example.com",
    displayName: kind === "admin" ? "Development Admin" : "Development User",
    teamIds: kind === "admin" ? ["platform"] : ["readonly"],
    teams: kind === "admin" ? ["platform"] : ["readonly"],
    groups,
    roles,
    clientId: "mcp-hub-web-dev",
    issuer: "dev",
    audience: "mcp-hub-web",
    isAdmin: hasAdminRole(roles),
    isPlatformAdmin: hasPlatformAdmin(roles, groups),
    authSource: "mock",
    tokenIssuer: "dev",
    projectId: readString(process.env, "MCP_PROJECT_ID", "00000000-0000-4000-8000-000000000020"),
  };
}

export function oidcClaimsToPrincipal(provider: OidcProviderConfig, claims: Record<string, unknown>): AuthContext {
  const roles = unique(readClaimList(claims, provider.roleClaim).concat(readClaimList(claims, "roles"), readClaimList(claims, "role")));
  const groups = unique(readClaimList(claims, provider.groupClaim).concat(readClaimList(claims, "groups")));
  const teams = unique(readClaimList(claims, provider.teamClaim).concat(readClaimList(claims, "team_ids"), readClaimList(claims, "teams")));
  const email = readClaimString(claims, "email");
  const emailDomain = email.includes("@") ? email.split("@").pop()?.toLowerCase() : undefined;
  const mappedAdmin = hasPlatformAdmin(roles, groups)
    || provider.adminRoles.some((role) => roles.includes(role))
    || provider.adminGroups.some((group) => groups.includes(group))
    || (emailDomain ? provider.adminEmailDomains.includes(emailDomain) : false);

  return {
    userId: firstNonEmpty(readClaimString(claims, "sub"), readClaimString(claims, "user_id"), email),
    principalType: "user",
    email: firstNonEmpty(email, readClaimString(claims, "preferred_username"), readClaimString(claims, "sub")),
    displayName: firstNonEmpty(readClaimString(claims, "name"), readClaimString(claims, "preferred_username"), email, readClaimString(claims, "sub")),
    teamIds: teams,
    teams,
    groups,
    roles,
    clientId: provider.clientId,
    issuer: provider.issuerUrl,
    audience: provider.clientId,
    isAdmin: mappedAdmin || hasAdminRole(roles),
    isPlatformAdmin: mappedAdmin,
    authSource: "oidc",
    tokenIssuer: provider.issuerUrl,
    projectId: firstNonEmpty(readClaimString(claims, "project_id"), readString(process.env, "MCP_PROJECT_ID", "00000000-0000-4000-8000-000000000020")),
  };
}

function readOidcProviders(env: Env, publicUrl: string, explicitProviderIds: string[]) {
  const configuredIds = unique(readCsv(env.MCP_WEB_OIDC_PROVIDERS).concat(explicitProviderIds.filter((id) => id !== "local" && id !== "dev")));
  const providers: OidcProviderConfig[] = [];

  for (const rawId of configuredIds) {
    const id = normalizeProviderId(rawId);
    const prefix = `MCP_WEB_OIDC_${toEnvProviderId(id)}_`;
    const enabled = isProviderEnabled(id, explicitProviderIds, env[`${prefix}ENABLED`] === "true");
    if (!enabled) {
      continue;
    }
    const issuerUrl = env[`${prefix}ISSUER_URL`]?.trim();
    const clientId = env[`${prefix}CLIENT_ID`]?.trim();
    const clientSecret = env[`${prefix}CLIENT_SECRET`]?.trim();
    if (!issuerUrl || !clientId || !clientSecret) {
      continue;
    }
    providers.push({
      id,
      displayName: readString(env, `${prefix}DISPLAY_NAME`, titleCase(id)),
      issuerUrl: issuerUrl.replace(/\/$/, ""),
      clientId,
      clientSecret,
      scopes: readString(env, `${prefix}SCOPES`, "openid profile email"),
      callbackUrl: readString(env, `${prefix}CALLBACK_URL`, `${publicUrl}/auth/oidc/${encodeURIComponent(id)}/callback`),
      endSessionUrl: env[`${prefix}END_SESSION_URL`]?.trim() || undefined,
      roleClaim: readString(env, `${prefix}ROLE_CLAIM`, "roles"),
      groupClaim: readString(env, `${prefix}GROUP_CLAIM`, "groups"),
      teamClaim: readString(env, `${prefix}TEAM_CLAIM`, "team_ids"),
      adminRoles: readCsv(env[`${prefix}ADMIN_ROLES`] ?? env[`${prefix}ADMIN_ROLE_VALUES`] ?? "admin,platform_admin"),
      adminGroups: readCsv(env[`${prefix}ADMIN_GROUPS`] ?? "platform-admins"),
      adminEmailDomains: readCsvRaw(env[`${prefix}ADMIN_EMAIL_DOMAINS`]).map((domain) => domain.toLowerCase()),
      tokenEndpointAuthMethod: env[`${prefix}TOKEN_ENDPOINT_AUTH_METHOD`] === "client_secret_post" ? "client_secret_post" : "client_secret_basic",
    });
  }

  return providers;
}

function readLocalUsers(env: Env) {
  const users = readLocalUsersJson(env.MCP_WEB_LOCAL_USERS);
  const adminUsername = env.MCP_WEB_LOCAL_ADMIN_USERNAME?.trim();
  const adminHash = env.MCP_WEB_LOCAL_ADMIN_PASSWORD_HASH?.trim();
  if (adminUsername && adminHash) {
    users.push({
      id: readString(env, "MCP_WEB_LOCAL_ADMIN_USER_ID", adminUsername),
      username: adminUsername,
      email: readString(env, "MCP_WEB_LOCAL_ADMIN_EMAIL", adminUsername.includes("@") ? adminUsername : `${adminUsername}@local`),
      displayName: readString(env, "MCP_WEB_LOCAL_ADMIN_DISPLAY_NAME", "Local Admin"),
      passwordHash: adminHash,
      roles: readCsv(env.MCP_WEB_LOCAL_ADMIN_ROLES ?? "platform_admin"),
      groups: readCsv(env.MCP_WEB_LOCAL_ADMIN_GROUPS ?? "platform-admins"),
      teams: readCsv(env.MCP_WEB_LOCAL_ADMIN_TEAMS ?? "platform"),
    });
  }
  return users;
}

function readLocalUsersJson(value: string | undefined): LocalUserConfig[] {
  if (!value?.trim()) {
    return [];
  }
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const record = item as Record<string, unknown>;
    const username = stringValue(record.username);
    const passwordHash = stringValue(record.passwordHash);
    if (!username || !passwordHash) {
      return [];
    }
    return [{
      id: stringValue(record.id) || username,
      username,
      email: stringValue(record.email) || (username.includes("@") ? username : `${username}@local`),
      displayName: stringValue(record.displayName) || username,
      passwordHash,
      roles: arrayValue(record.roles),
      groups: arrayValue(record.groups),
      teams: arrayValue(record.teams),
    }];
  });
}

function isProviderEnabled(id: string, explicitProviderIds: string[], fallback: boolean) {
  return explicitProviderIds.length > 0 ? explicitProviderIds.includes(id) : fallback;
}

function readString(env: Env, key: string, fallback: string) {
  return env[key]?.trim() || fallback;
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readCsv(value: string | undefined) {
  return unique((value ?? "").split(",").map((item) => normalizeProviderId(item)).filter(Boolean));
}

function readCsvRaw(value: string | undefined) {
  return unique((value ?? "").split(",").map((item) => item.trim()).filter(Boolean));
}

function normalizeProviderId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function toEnvProviderId(id: string) {
  return id.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

function titleCase(id: string) {
  return id.split(/[-_]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function arrayValue(value: unknown) {
  if (typeof value === "string") {
    return readCsv(value);
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return unique(value.filter((item): item is string => typeof item === "string"));
}

function readClaimString(claims: Record<string, unknown>, key: string) {
  return stringValue(claims[key]);
}

function readClaimList(claims: Record<string, unknown>, key: string) {
  return arrayValue(claims[key]);
}

function hasAdminRole(roles: string[]) {
  return roles.includes("admin") || roles.includes("platform_admin");
}

function hasPlatformAdmin(roles: string[], groups: string[]) {
  return hasAdminRole(roles) || groups.includes("platform-admins");
}

function firstNonEmpty(...values: string[]) {
  return values.find((value) => value.trim().length > 0)?.trim() ?? "";
}
