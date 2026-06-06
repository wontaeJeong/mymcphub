import { createLocalJWKSet, jwtVerify, type JSONWebKeySet, type JWTPayload } from "jose";

export type PrincipalType = "user" | "team" | "service_account";

export type AuthSource = "mock" | "oidc" | "service_account";

export type AuthenticatedPrincipal = {
  subject: string;
  principalType: PrincipalType;
  issuer: string;
  audience: string;
  clientId: string;
  email?: string;
  displayName?: string;
  teamIds: string[];
  teams: string[];
  groups: string[];
  roles: string[];
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  authSource: AuthSource;
  tokenIssuer: string;
};

export interface TokenVerifier {
  verify(token: string): Promise<AuthenticatedPrincipal>;
}

export type AuthVerificationErrorCode =
  | "INVALID_TOKEN"
  | "INVALID_CLAIMS"
  | "UNTRUSTED_CLIENT"
  | "SERVICE_ACCOUNT_NOT_CONFIGURED";

export class AuthVerificationError extends Error {
  code: AuthVerificationErrorCode;

  constructor(code: AuthVerificationErrorCode, message: string) {
    super(message);
    this.name = "AuthVerificationError";
    this.code = code;
  }
}

export type MockPrincipalOptions = Partial<AuthenticatedPrincipal>;

export const mockAuthTokens = {
  admin: "dev-admin-token",
  readOnly: "dev-readonly-token"
} as const;

export function createMockPrincipal(options: MockPrincipalOptions = {}): AuthenticatedPrincipal {
  const issuer = options.issuer ?? options.tokenIssuer ?? "mock-auth";
  const teamIds = uniqueStrings(options.teamIds ?? options.teams ?? ["platform-team"]);

  return {
    subject: options.subject ?? "admin-user",
    principalType: options.principalType ?? "user",
    issuer,
    audience: options.audience ?? "mcp-hub",
    clientId: options.clientId ?? "local-dev-client",
    email: options.email ?? "admin@example.com",
    displayName: options.displayName ?? "Admin User",
    teamIds,
    teams: uniqueStrings(options.teams ?? teamIds),
    groups: uniqueStrings(options.groups ?? ["platform"]),
    roles: uniqueStrings(options.roles ?? ["admin"]),
    isAdmin: options.isAdmin ?? true,
    isPlatformAdmin: options.isPlatformAdmin ?? true,
    authSource: options.authSource ?? "mock",
    tokenIssuer: issuer
  };
}

export function createMockAdminPrincipal(options: MockPrincipalOptions = {}): AuthenticatedPrincipal {
  return createMockPrincipal(options);
}

export function createMockReadOnlyPrincipal(options: MockPrincipalOptions = {}): AuthenticatedPrincipal {
  return createMockPrincipal({
    subject: "readonly-user",
    email: "readonly@example.com",
    displayName: "Read Only User",
    teamIds: ["readonly-team"],
    teams: ["readonly-team"],
    groups: ["readonly"],
    roles: ["reader"],
    isAdmin: false,
    isPlatformAdmin: false,
    ...options
  });
}

export type MockTokenVerifierOptions = {
  principals?: Record<string, AuthenticatedPrincipal>;
};

export function createMockTokenVerifier(options: MockTokenVerifierOptions = {}): TokenVerifier {
  const principals = options.principals ?? {
    [mockAuthTokens.admin]: createMockAdminPrincipal(),
    [mockAuthTokens.readOnly]: createMockReadOnlyPrincipal()
  };

  return {
    async verify(token: string) {
      const principal = principals[token];

      if (!principal) {
        throw new AuthVerificationError("INVALID_TOKEN", "Mock token is not recognized.");
      }

      return principal;
    }
  };
}

export type ServiceAccountTokenClaims = {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  principal_type: "service_account";
  client_id?: string;
  azp?: string;
  team_ids?: string[];
  groups?: string[];
  roles?: string[];
};

export type ServiceAccountVerifierConfig = {
  enabled: true;
  allowedSubjects?: string[];
  subjectPrefix?: string;
};

export type ServiceAccountPrincipal = AuthenticatedPrincipal & {
  principalType: "service_account";
};

export type OidcClaimMappings = {
  principalTypeClaim?: string;
  emailClaim?: string;
  displayNameClaim?: string;
  teamIdsClaim?: string;
  teamsClaim?: string;
  groupsClaim?: string;
  rolesClaim?: string;
  adminRoleValues?: string[];
  adminGroupValues?: string[];
  adminTeamIds?: string[];
  platformAdminRoleValues?: string[];
  platformAdminGroupValues?: string[];
  platformAdminTeamIds?: string[];
};

export type OidcJwtVerifierConfig = {
  issuer: string;
  audience: string | string[];
  trustedClientIds: string[];
  jwks: JSONWebKeySet;
  algorithms?: string[];
  clockToleranceSeconds?: number;
  claimMappings?: OidcClaimMappings;
  serviceAccount?: ServiceAccountVerifierConfig;
};

export type VerifiedOidcClaimsMappingOptions = Pick<
  OidcJwtVerifierConfig,
  "issuer" | "audience" | "trustedClientIds" | "claimMappings" | "serviceAccount"
>;

export const defaultOidcJwtAlgorithms = ["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"];

export const defaultOidcClaimMappings = {
  principalTypeClaim: "principal_type",
  emailClaim: "email",
  displayNameClaim: "name",
  teamIdsClaim: "team_ids",
  teamsClaim: "teams",
  groupsClaim: "groups",
  rolesClaim: "roles",
  adminRoleValues: ["admin"],
  adminGroupValues: ["mcp-admins"],
  adminTeamIds: [],
  platformAdminRoleValues: ["platform_admin"],
  platformAdminGroupValues: ["platform-admins"],
  platformAdminTeamIds: []
} satisfies Required<OidcClaimMappings>;

export function createOidcJwtVerifier(config: OidcJwtVerifierConfig): TokenVerifier {
  validateOidcVerifierConfig(config);

  const jwkSet = createLocalJWKSet(config.jwks);

  return {
    async verify(token: string) {
      try {
        const result = await jwtVerify(token, jwkSet, {
          algorithms: config.algorithms ?? defaultOidcJwtAlgorithms,
          audience: config.audience,
          clockTolerance: config.clockToleranceSeconds ?? 5,
          issuer: config.issuer
        });

        return mapVerifiedOidcClaimsToPrincipal(result.payload, config);
      } catch (caught: unknown) {
        if (caught instanceof AuthVerificationError) {
          throw caught;
        }

        const message = caught instanceof Error ? caught.message : "OIDC token verification failed.";
        throw new AuthVerificationError("INVALID_TOKEN", message);
      }
    }
  };
}

export function mapVerifiedOidcClaimsToPrincipal(
  payload: JWTPayload,
  options: VerifiedOidcClaimsMappingOptions
): AuthenticatedPrincipal {
  const claims = payload as Record<string, unknown>;
  const mappings = { ...defaultOidcClaimMappings, ...options.claimMappings };
  const issuer = requireStringClaim(claims, "iss");
  const subject = requireStringClaim(claims, "sub");
  const audience = normalizeAudience(payload.aud, options.audience);
  const clientId = readClientId(claims);
  const principalType = readPrincipalType(claims, mappings.principalTypeClaim);
  const teamIds = readStringArrayClaim(claims, mappings.teamIdsClaim);
  const teams = readStringArrayClaim(claims, mappings.teamsClaim);
  const groups = readStringArrayClaim(claims, mappings.groupsClaim);
  const roles = readStringArrayClaim(claims, mappings.rolesClaim);
  const email = readOptionalStringClaim(claims, mappings.emailClaim);
  const displayName = readOptionalStringClaim(claims, mappings.displayNameClaim);

  if (issuer !== options.issuer) {
    throw new AuthVerificationError("INVALID_CLAIMS", "OIDC issuer does not match verifier configuration.");
  }
  if (!audience) {
    throw new AuthVerificationError("INVALID_CLAIMS", "OIDC audience does not match verifier configuration.");
  }
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    throw new AuthVerificationError("INVALID_CLAIMS", "OIDC token must include a numeric exp claim.");
  }
  if (!options.trustedClientIds.includes(clientId)) {
    throw new AuthVerificationError("UNTRUSTED_CLIENT", "OIDC token client_id or azp is not trusted.");
  }

  validateServiceAccountClaims(principalType, subject, options.serviceAccount);

  const normalizedTeamIds = uniqueStrings(teamIds);
  const normalizedGroups = uniqueStrings(groups);
  const normalizedRoles = uniqueStrings(roles);

  return {
    subject,
    principalType,
    issuer,
    audience,
    clientId,
    email,
    displayName,
    teamIds: normalizedTeamIds,
    teams: uniqueStrings(teams.length > 0 ? teams : normalizedTeamIds),
    groups: normalizedGroups,
    roles: normalizedRoles,
    isAdmin: matchesAny(normalizedRoles, mappings.adminRoleValues) || matchesAny(normalizedGroups, mappings.adminGroupValues) || matchesAny(normalizedTeamIds, mappings.adminTeamIds),
    isPlatformAdmin:
      matchesAny(normalizedRoles, mappings.platformAdminRoleValues) ||
      matchesAny(normalizedGroups, mappings.platformAdminGroupValues) ||
      matchesAny(normalizedTeamIds, mappings.platformAdminTeamIds),
    authSource: "oidc",
    tokenIssuer: issuer
  };
}

export const mapOidcClaimsToPrincipal = mapVerifiedOidcClaimsToPrincipal;

function validateOidcVerifierConfig(config: OidcJwtVerifierConfig) {
  if (!isNonEmptyString(config.issuer)) {
    throw new AuthVerificationError("INVALID_CLAIMS", "OIDC verifier issuer must be configured.");
  }
  if (!hasAudience(config.audience)) {
    throw new AuthVerificationError("INVALID_CLAIMS", "OIDC verifier audience must be configured.");
  }
  if (config.trustedClientIds.length === 0 || config.trustedClientIds.some((clientId) => !isNonEmptyString(clientId))) {
    throw new AuthVerificationError("INVALID_CLAIMS", "OIDC verifier trustedClientIds must be configured.");
  }
}

function requireStringClaim(claims: Record<string, unknown>, claimName: string) {
  const value = claims[claimName];

  if (!isNonEmptyString(value)) {
    throw new AuthVerificationError("INVALID_CLAIMS", `OIDC claim ${claimName} must be a non-empty string.`);
  }

  return value;
}

function readOptionalStringClaim(claims: Record<string, unknown>, claimName: string) {
  const value = claims[claimName];

  if (value === undefined) {
    return undefined;
  }
  if (!isNonEmptyString(value)) {
    throw new AuthVerificationError("INVALID_CLAIMS", `OIDC claim ${claimName} must be a non-empty string when present.`);
  }

  return value;
}

function readStringArrayClaim(claims: Record<string, unknown>, claimName: string) {
  const value = claims[claimName];

  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => !isNonEmptyString(item))) {
    throw new AuthVerificationError("INVALID_CLAIMS", `OIDC claim ${claimName} must be an array of non-empty strings when present.`);
  }

  return value;
}

function readClientId(claims: Record<string, unknown>) {
  const clientId = claims.client_id;
  const azp = claims.azp;

  if (clientId !== undefined && !isNonEmptyString(clientId)) {
    throw new AuthVerificationError("INVALID_CLAIMS", "OIDC claim client_id must be a non-empty string when present.");
  }
  if (azp !== undefined && !isNonEmptyString(azp)) {
    throw new AuthVerificationError("INVALID_CLAIMS", "OIDC claim azp must be a non-empty string when present.");
  }

  if (isNonEmptyString(clientId)) {
    return clientId;
  }
  if (isNonEmptyString(azp)) {
    return azp;
  }

  throw new AuthVerificationError("INVALID_CLAIMS", "OIDC token must include client_id or azp.");
}

function readPrincipalType(claims: Record<string, unknown>, claimName: string): PrincipalType {
  const value = claims[claimName];

  if (value === undefined) {
    return "user";
  }
  if (value === "user" || value === "team" || value === "service_account") {
    return value;
  }

  throw new AuthVerificationError("INVALID_CLAIMS", `OIDC claim ${claimName} must be user, team, or service_account when present.`);
}

function validateServiceAccountClaims(
  principalType: PrincipalType,
  subject: string,
  serviceAccount: ServiceAccountVerifierConfig | undefined
) {
  if (principalType !== "service_account") {
    return;
  }
  if (!serviceAccount?.enabled) {
    throw new AuthVerificationError(
      "SERVICE_ACCOUNT_NOT_CONFIGURED",
      "Service-account tokens require explicit verifier serviceAccount configuration."
    );
  }
  if (serviceAccount.allowedSubjects && !serviceAccount.allowedSubjects.includes(subject)) {
    throw new AuthVerificationError("INVALID_CLAIMS", "Service-account subject is not allowed by verifier configuration.");
  }
  if (serviceAccount.subjectPrefix && !subject.startsWith(serviceAccount.subjectPrefix)) {
    throw new AuthVerificationError("INVALID_CLAIMS", "Service-account subject does not match verifier subjectPrefix.");
  }
}

function normalizeAudience(actual: JWTPayload["aud"], expected: string | string[]) {
  const expectedAudiences = Array.isArray(expected) ? expected : [expected];

  if (typeof actual === "string") {
    return expectedAudiences.includes(actual) ? actual : undefined;
  }
  if (Array.isArray(actual)) {
    return actual.find((audience) => expectedAudiences.includes(audience));
  }

  return undefined;
}

function hasAudience(audience: string | string[]) {
  if (Array.isArray(audience)) {
    return audience.length > 0 && audience.every(isNonEmptyString);
  }

  return isNonEmptyString(audience);
}

function matchesAny(actualValues: string[], expectedValues: string[]) {
  return expectedValues.some((expectedValue) => actualValues.includes(expectedValue));
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
