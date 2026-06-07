import { describe, expect, it, vi } from "vitest";

import { getWebAuthConfig, oidcClaimsToPrincipal } from "../lib/auth/config";
import { hashPassword, verifyPassword } from "../lib/auth/password";
import { validateOidcClaims } from "../lib/auth/oidc";
import { createSessionToken, verifySessionToken } from "../lib/auth/session";
import { createTransactionToken, verifyTransactionToken } from "../lib/auth/transaction";

describe("web auth provider configuration", () => {
  it("exposes only configured public providers and keeps OIDC secrets server-side", () => {
    const config = getWebAuthConfig({
      NODE_ENV: "production",
      MCP_HUB_PUBLIC_URL: "https://hub.example.com",
      MCP_WEB_AUTH_ENABLED_PROVIDERS: "local,okta",
      MCP_WEB_LOCAL_AUTH_ENABLED: "true",
      MCP_WEB_LOCAL_USERS: JSON.stringify([{ username: "admin", passwordHash: "scrypt$2$1$1$c2FsdA$aGFzaA", roles: ["platform_admin"] }]),
      MCP_WEB_OIDC_OKTA_ISSUER_URL: "https://okta.example.com/oauth2/default",
      MCP_WEB_OIDC_OKTA_CLIENT_ID: "client-id",
      MCP_WEB_OIDC_OKTA_CLIENT_SECRET: "secret-value",
      MCP_WEB_OIDC_OKTA_DISPLAY_NAME: "Okta",
      MCP_WEB_OIDC_OKTA_ADMIN_GROUPS: "platform-admins",
    });

    expect(config.publicProviders).toEqual([
      { id: "local", kind: "local", displayName: "Username and password" },
      { id: "okta", kind: "oidc", displayName: "Okta" },
    ]);
    expect(JSON.stringify(config.publicProviders)).not.toContain("secret-value");
    expect(config.oidcProviders[0]?.callbackUrl).toBe("https://hub.example.com/auth/oidc/okta/callback");
  });

  it("does not enable the dev provider by default in production", () => {
    expect(getWebAuthConfig({ NODE_ENV: "production" }).publicProviders).toEqual([]);
    expect(getWebAuthConfig({ NODE_ENV: "development" }).publicProviders).toContainEqual({ id: "dev", kind: "dev", displayName: "Development login" });
  });

  it("maps admin roles, groups, and domains from OIDC claims", () => {
    const provider = getWebAuthConfig({
      NODE_ENV: "production",
      MCP_WEB_AUTH_ENABLED_PROVIDERS: "google",
      MCP_WEB_OIDC_GOOGLE_ISSUER_URL: "https://accounts.google.com",
      MCP_WEB_OIDC_GOOGLE_CLIENT_ID: "client-id",
      MCP_WEB_OIDC_GOOGLE_CLIENT_SECRET: "secret-value",
      MCP_WEB_OIDC_GOOGLE_ADMIN_EMAIL_DOMAINS: "example.com",
    }).oidcProviders[0];

    expect(provider).toBeDefined();
    const principal = oidcClaimsToPrincipal(provider!, {
      sub: "user-1",
      email: "alice@example.com",
      name: "Alice",
      roles: ["reader"],
      groups: ["engineering"],
    });

    expect(principal.isPlatformAdmin).toBe(true);
    expect(principal.email).toBe("alice@example.com");
  });
});

describe("web auth security helpers", () => {
  it("verifies local password hashes with scrypt", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });

  it("rejects tampered or expired signed sessions", () => {
    vi.stubEnv("MCP_WEB_SESSION_SECRET", "test-session-secret");
    const token = createSessionToken({
      userId: "user-1",
      principalType: "user",
      email: "user@example.com",
      displayName: "User",
      teamIds: [],
      teams: [],
      groups: [],
      roles: ["reader"],
      clientId: "web",
      issuer: "local",
      audience: "web",
      isAdmin: false,
      isPlatformAdmin: false,
      authSource: "local",
      tokenIssuer: "local",
      projectId: "project-1",
    }, 100);

    expect(verifySessionToken(token, 101)?.principal.userId).toBe("user-1");
    expect(verifySessionToken(`${token}tampered`, 101)).toBeUndefined();
    expect(verifySessionToken(token, 100 + 28_801)).toBeUndefined();
    vi.unstubAllEnvs();
  });

  it("rejects OIDC callback state and nonce mismatches", () => {
    vi.stubEnv("MCP_WEB_SESSION_SECRET", "test-session-secret");
    const transaction = createTransactionToken({ providerId: "okta", state: "expected", nonce: "nonce", codeVerifier: "verifier", nextPath: "/user", expiresAt: 200 });
    expect(verifyTransactionToken(transaction, "expected", 100)?.codeVerifier).toBe("verifier");
    expect(verifyTransactionToken(transaction, "wrong", 100)).toBeUndefined();
    expect(() => validateOidcClaims({
      id: "okta",
      displayName: "Okta",
      issuerUrl: "https://issuer.example",
      clientId: "client-id",
      clientSecret: "secret",
      scopes: "openid profile email",
      callbackUrl: "https://hub.example/auth/oidc/okta/callback",
      roleClaim: "roles",
      groupClaim: "groups",
      teamClaim: "team_ids",
      adminRoles: ["platform_admin"],
      adminGroups: ["platform-admins"],
      adminEmailDomains: [],
      tokenEndpointAuthMethod: "client_secret_basic",
    }, { iss: "https://issuer.example", aud: "client-id", sub: "user-1", exp: 300, nonce: "other" }, "nonce", 100)).toThrow("nonce");
    vi.unstubAllEnvs();
  });
});
