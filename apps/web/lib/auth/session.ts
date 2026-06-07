import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

import type { AuthContext } from "../api";
import { getWebAuthConfig } from "./config";

export type WebSession = Readonly<{
  id: string;
  principal: AuthContext;
  issuedAt: number;
  expiresAt: number;
}>;

type SessionPayload = WebSession;

export async function getCurrentSession(now = Math.floor(Date.now() / 1000)) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getWebAuthConfig().sessionCookieName)?.value;
    return verifySessionToken(token, now);
  } catch {
    return undefined;
  }
}

export async function requireCurrentSession() {
  return getCurrentSession();
}

export function createSessionToken(principal: AuthContext, now = Math.floor(Date.now() / 1000)) {
  const config = getWebAuthConfig();
  const payload: SessionPayload = {
    id: randomBytes(16).toString("base64url"),
    principal,
    issuedAt: now,
    expiresAt: now + config.sessionTtlSeconds,
  };
  return signJson(payload);
}

export function verifySessionToken(token: string | undefined, now = Math.floor(Date.now() / 1000)): WebSession | undefined {
  const payload = verifySignedJson<SessionPayload>(token);
  if (!payload || payload.expiresAt <= now || payload.issuedAt > now + 60) {
    return undefined;
  }
  return payload;
}

export function setSessionCookie(response: NextResponse, request: NextRequest, principal: AuthContext) {
  const config = getWebAuthConfig();
  response.cookies.set({
    name: config.sessionCookieName,
    value: createSessionToken(principal),
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: "lax",
    path: "/",
    maxAge: config.sessionTtlSeconds,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: getWebAuthConfig().sessionCookieName,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function trustedIdentityHeaders() {
  const session = await getCurrentSession();
  if (!session) {
    return new Headers();
  }
  return headersForPrincipal(session.principal);
}

export function headersForPrincipal(principal: AuthContext) {
  const headers = new Headers();
  headers.set("x-user-id", principal.userId);
  headers.set("x-principal-type", principal.principalType);
  headers.set("x-user-email", principal.email);
  headers.set("x-user-display-name", principal.displayName);
  headers.set("x-team-ids", principal.teamIds.join(","));
  headers.set("x-teams", principal.teams.join(","));
  headers.set("x-groups", principal.groups.join(","));
  headers.set("x-roles", principal.roles.join(","));
  headers.set("x-client-id", principal.clientId);
  const trustedToken = process.env.MCP_WEB_API_TRUSTED_HEADER_TOKEN ?? process.env.MCP_TRUSTED_AUTH_HEADER_TOKEN;
  if (trustedToken) {
    headers.set("x-auth-proxy-token", trustedToken);
  }
  const proxySecret = process.env.MCP_WEB_API_TRUSTED_PROXY_SECRET ?? process.env.MCP_TRUSTED_PROXY_SECRET;
  if (proxySecret) {
    headers.set(process.env.MCP_TRUSTED_PROXY_HEADER || "x-mcp-hub-trusted-proxy", proxySecret);
  }
  return headers;
}

export function signJson(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = hmac(payload);
  return `${payload}.${signature}`;
}

export function verifySignedJson<T>(token: string | undefined): T | undefined {
  if (!token) {
    return undefined;
  }
  const separator = token.lastIndexOf(".");
  if (separator <= 0) {
    return undefined;
  }
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!safeEqual(signature, hmac(payload))) {
    return undefined;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return undefined;
  }
}

export function isSecureRequest(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwardedProto) {
    return forwardedProto === "https";
  }
  return request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";
}

function hmac(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function sessionSecret() {
  const secret = process.env.MCP_WEB_SESSION_SECRET ?? process.env.AUTH_SECRET;
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("MCP_WEB_SESSION_SECRET is required in production.");
  }
  return "mcp-hub-dev-session-secret";
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
