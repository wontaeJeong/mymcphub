import { createPublicKey, createVerify, randomBytes, type JsonWebKey as NodeJsonWebKey } from "node:crypto";

import type { OidcProviderConfig } from "./config";

export type OidcDiscovery = Readonly<{
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
}>;

type OidcJwk = NodeJsonWebKey & Readonly<{ kid?: string }>;
type JwksDocument = Readonly<{ keys: OidcJwk[] }>;

export function randomBase64Url(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export async function pkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return Buffer.from(digest).toString("base64url");
}

export async function discoverOidc(provider: OidcProviderConfig): Promise<OidcDiscovery> {
  const response = await fetch(`${provider.issuerUrl}/.well-known/openid-configuration`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("OIDC discovery failed.");
  }
  const discovery = await response.json() as Partial<OidcDiscovery>;
  if (discovery.issuer !== provider.issuerUrl || !discovery.authorization_endpoint || !discovery.token_endpoint || !discovery.jwks_uri) {
    throw new Error("OIDC discovery document is incomplete or issuer-mismatched.");
  }
  return discovery as OidcDiscovery;
}

export function authorizationUrl(provider: OidcProviderConfig, discovery: OidcDiscovery, state: string, nonce: string, codeChallenge: string, nextPath: string) {
  const url = new URL(discovery.authorization_endpoint);
  url.searchParams.set("client_id", provider.clientId);
  url.searchParams.set("redirect_uri", provider.callbackUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", provider.scopes.includes("openid") ? provider.scopes : `openid ${provider.scopes}`.trim());
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  sanitizeRedirectPath(nextPath);
  return url;
}

export async function exchangeAuthorizationCode(provider: OidcProviderConfig, discovery: OidcDiscovery, code: string, codeVerifier: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: provider.callbackUrl,
    code_verifier: codeVerifier,
  });
  const headers = new Headers({ "content-type": "application/x-www-form-urlencoded" });
  if (provider.tokenEndpointAuthMethod === "client_secret_post") {
    body.set("client_id", provider.clientId);
    body.set("client_secret", provider.clientSecret);
  } else {
    headers.set("authorization", `Basic ${Buffer.from(`${provider.clientId}:${provider.clientSecret}`).toString("base64")}`);
  }
  const response = await fetch(discovery.token_endpoint, { method: "POST", headers, body, cache: "no-store" });
  if (!response.ok) {
    throw new Error("OIDC token exchange failed.");
  }
  return await response.json() as { id_token?: string; access_token?: string };
}

export async function verifyIdToken(provider: OidcProviderConfig, discovery: OidcDiscovery, idToken: string, expectedNonce: string, now = Math.floor(Date.now() / 1000)) {
  const parsed = parseJwt(idToken);
  if (parsed.header.alg !== "RS256") {
    throw new Error("OIDC id_token uses an unsupported signing algorithm.");
  }
  const jwks = await loadJwks(discovery.jwks_uri);
  const jwk = jwks.keys.find((key) => key.kid === parsed.header.kid);
  if (!jwk) {
    throw new Error("OIDC signing key was not found.");
  }
  const verifier = createVerify("RSA-SHA256");
  verifier.update(parsed.signingInput);
  verifier.end();
  if (!verifier.verify(createPublicKey({ key: jwk, format: "jwk" }), parsed.signature)) {
    throw new Error("OIDC id_token signature verification failed.");
  }
  validateOidcClaims(provider, parsed.claims, expectedNonce, now);
  return parsed.claims;
}

export function validateOidcClaims(provider: OidcProviderConfig, claims: Record<string, unknown>, expectedNonce: string, now = Math.floor(Date.now() / 1000)) {
  if (claims.iss !== provider.issuerUrl) {
    throw new Error("OIDC issuer is invalid.");
  }
  if (!audienceContains(claims.aud, provider.clientId)) {
    throw new Error("OIDC audience is invalid.");
  }
  if (claims.nonce !== expectedNonce) {
    throw new Error("OIDC nonce is invalid.");
  }
  const exp = numericClaim(claims.exp);
  if (!exp || exp <= now) {
    throw new Error("OIDC id_token is expired.");
  }
  const nbf = numericClaim(claims.nbf);
  if (nbf && nbf > now + 60) {
    throw new Error("OIDC id_token is not valid yet.");
  }
  if (typeof claims.sub !== "string" || claims.sub.trim() === "") {
    throw new Error("OIDC subject is missing.");
  }
}

export async function fetchUserInfo(discovery: OidcDiscovery, accessToken: string | undefined) {
  if (!discovery.userinfo_endpoint || !accessToken) {
    return {};
  }
  const response = await fetch(discovery.userinfo_endpoint, { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!response.ok) {
    return {};
  }
  return await response.json() as Record<string, unknown>;
}

export function sanitizeRedirectPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/user";
  }
  return value;
}

function parseJwt(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("OIDC id_token is malformed.");
  }
  const header = JSON.parse(Buffer.from(parts[0] ?? "", "base64url").toString("utf8")) as { alg?: string; kid?: string };
  const claims = JSON.parse(Buffer.from(parts[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
  return {
    header,
    claims,
    signingInput: `${parts[0]}.${parts[1]}`,
    signature: Buffer.from(parts[2] ?? "", "base64url"),
  };
}

async function loadJwks(jwksUri: string) {
  const response = await fetch(jwksUri, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("OIDC JWKS fetch failed.");
  }
  return await response.json() as JwksDocument;
}

function audienceContains(value: unknown, expected: string) {
  if (typeof value === "string") {
    return value === expected;
  }
  if (Array.isArray(value)) {
    return value.includes(expected);
  }
  return false;
}

function numericClaim(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
