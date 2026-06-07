import { NextResponse, type NextRequest } from "next/server";

import { findLocalUser, getWebAuthConfig, localUserToPrincipal, normalizeUsername } from "../../../lib/auth/config";
import { checkLoginRateLimit, clearLoginFailures, recordLoginFailure } from "../../../lib/auth/rate-limit";
import { setSessionCookie } from "../../../lib/auth/session";
import { verifyPassword } from "../../../lib/auth/password";
import { sanitizeRedirectPath } from "../../../lib/auth/oidc";

export async function POST(request: NextRequest) {
  const config = getWebAuthConfig();
  if (!config.localEnabled) {
    return redirectWithError(request, "local_disabled");
  }
  const formData = await request.formData();
  const username = readFormValue(formData, "username");
  const password = readFormValue(formData, "password");
  const nextPath = sanitizeRedirectPath(readFormValue(formData, "next"));
  const rateKey = loginRateKey(request, username);
  const decision = checkLoginRateLimit(rateKey);
  if (!decision.allowed) {
    return redirectWithError(request, "rate_limited", nextPath);
  }
  const user = findLocalUser(username);
  const passwordOk = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !passwordOk) {
    recordLoginFailure(rateKey);
    return redirectWithError(request, "invalid_credentials", nextPath);
  }
  clearLoginFailures(rateKey);
  const response = NextResponse.redirect(new URL(nextPath, request.url));
  setSessionCookie(response, request, localUserToPrincipal(user));
  return response;
}

function redirectWithError(request: NextRequest, error: string, nextPath = "/user") {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  url.searchParams.set("next", sanitizeRedirectPath(nextPath));
  return NextResponse.redirect(url);
}

function readFormValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function loginRateKey(request: NextRequest, username: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return `local:${ip}:${normalizeUsername(username)}`;
}
