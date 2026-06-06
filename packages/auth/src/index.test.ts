import { exportJWK, generateKeyPair, SignJWT, type JSONWebKeySet } from "jose";
import { describe, expect, it } from "vitest";

import {
  createMockAdminPrincipal,
  createMockReadOnlyPrincipal,
  createMockTokenVerifier,
  createOidcJwtVerifier,
  mockAuthTokens,
  type OidcJwtVerifierConfig
} from "./index";

const issuer = "https://issuer.example.com";
const audience = "mcp-hub";
const trustedClientId = "mcp-client";

describe("mock auth utilities", () => {
  it("creates admin and read-only style principals", async () => {
    const admin = createMockAdminPrincipal();
    const readOnly = createMockReadOnlyPrincipal();
    const verifier = createMockTokenVerifier();

    await expect(verifier.verify(mockAuthTokens.admin)).resolves.toMatchObject({
      subject: admin.subject,
      principalType: "user",
      teamIds: ["platform-team"],
      teams: ["platform-team"],
      isAdmin: true,
      isPlatformAdmin: true,
      authSource: "mock"
    });
    await expect(verifier.verify(mockAuthTokens.readOnly)).resolves.toMatchObject({
      subject: readOnly.subject,
      roles: ["reader"],
      isAdmin: false,
      isPlatformAdmin: false
    });
    await expect(verifier.verify("unknown-token")).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });
});

describe("OIDC JWT verifier", () => {
  it("verifies a signed JWT and maps normalized principal claims", async () => {
    const fixture = await createVerifierFixture();
    const token = await fixture.sign({
      clientId: trustedClientId,
      email: "admin@example.com",
      name: "Admin User",
      team_ids: ["platform-team", "ops-team"],
      teams: ["Platform", "Operations"],
      groups: ["mcp-admins"],
      roles: ["platform_admin"]
    });

    await expect(fixture.verifier.verify(token)).resolves.toMatchObject({
      subject: "user-1",
      principalType: "user",
      issuer,
      audience,
      clientId: trustedClientId,
      email: "admin@example.com",
      displayName: "Admin User",
      teamIds: ["platform-team", "ops-team"],
      teams: ["Platform", "Operations"],
      groups: ["mcp-admins"],
      roles: ["platform_admin"],
      isAdmin: true,
      isPlatformAdmin: true,
      authSource: "oidc",
      tokenIssuer: issuer
    });
  });

  it("accepts azp as the trusted client claim when client_id is absent", async () => {
    const fixture = await createVerifierFixture();
    const token = await fixture.sign({ azp: trustedClientId });

    await expect(fixture.verifier.verify(token)).resolves.toMatchObject({ clientId: trustedClientId });
  });

  it.each([
    ["wrong issuer", { issuerOverride: "https://evil.example.com" }, "unexpected \"iss\" claim value"],
    ["wrong audience", { audienceOverride: "other-audience" }, "unexpected \"aud\" claim value"],
    ["missing subject", { omitSubject: true }, "OIDC claim sub must be a non-empty string"],
    ["missing exp", { omitExpiration: true }, "OIDC token must include a numeric exp claim"],
    ["untrusted client", { clientId: "other-client" }, "OIDC token client_id or azp is not trusted"],
    ["malformed groups", { groups: "mcp-admins" }, "OIDC claim groups must be an array"],
    ["malformed roles", { roles: ["admin", 7] }, "OIDC claim roles must be an array"]
  ])("rejects %s", async (_name, tokenOptions, expectedMessage) => {
    const fixture = await createVerifierFixture();
    const token = await fixture.sign(tokenOptions);

    await expect(fixture.verifier.verify(token)).rejects.toThrow(expectedMessage);
  });

  it("rejects tokens signed by an untrusted key", async () => {
    const fixture = await createVerifierFixture();
    const otherFixture = await createVerifierFixture();
    const token = await otherFixture.sign({ clientId: trustedClientId });

    await expect(fixture.verifier.verify(token)).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("rejects service-account tokens unless the verifier opts in", async () => {
    const fixture = await createVerifierFixture();
    const token = await fixture.sign({
      clientId: trustedClientId,
      principal_type: "service_account"
    });

    await expect(fixture.verifier.verify(token)).rejects.toMatchObject({ code: "SERVICE_ACCOUNT_NOT_CONFIGURED" });
  });

  it("maps service-account tokens with explicit subject configuration", async () => {
    const fixture = await createVerifierFixture({
      serviceAccount: { enabled: true, subjectPrefix: "svc:" }
    });
    const token = await fixture.sign({
      clientId: trustedClientId,
      principal_type: "service_account",
      subjectOverride: "svc:catalog-sync"
    });

    await expect(fixture.verifier.verify(token)).resolves.toMatchObject({
      subject: "svc:catalog-sync",
      principalType: "service_account",
      authSource: "oidc"
    });
  });
});

type TokenOptions = {
  issuerOverride?: string;
  audienceOverride?: string;
  subjectOverride?: string;
  omitSubject?: boolean;
  omitExpiration?: boolean;
  clientId?: string;
  azp?: string;
  principal_type?: string;
  email?: string;
  name?: string;
  team_ids?: unknown;
  teams?: unknown;
  groups?: unknown;
  roles?: unknown;
};

async function createVerifierFixture(config: Partial<OidcJwtVerifierConfig> = {}) {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "test-key";
  const jwks: JSONWebKeySet = { keys: [publicJwk] };
  const verifier = createOidcJwtVerifier({
    issuer,
    audience,
    trustedClientIds: [trustedClientId],
    jwks,
    ...config
  });

  async function sign(options: TokenOptions) {
    const claims: Record<string, unknown> = {
      client_id: options.clientId ?? (options.azp === undefined ? trustedClientId : undefined),
      azp: options.azp,
      email: options.email,
      name: options.name,
      principal_type: options.principal_type,
      team_ids: options.team_ids,
      teams: options.teams,
      groups: options.groups,
      roles: options.roles
    };

    const builder = new SignJWT(removeUndefined(claims))
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(options.issuerOverride ?? issuer)
      .setAudience(options.audienceOverride ?? audience)
      .setIssuedAt();

    const subject = options.subjectOverride ?? "user-1";
    const withSubject = options.omitSubject ? builder : builder.setSubject(subject);
    const withExpiration = options.omitExpiration ? withSubject : withSubject.setExpirationTime("5m");

    return withExpiration.sign(privateKey);
  }

  return { verifier, sign };
}

function removeUndefined(record: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(record).filter((entry) => entry[1] !== undefined));
}
