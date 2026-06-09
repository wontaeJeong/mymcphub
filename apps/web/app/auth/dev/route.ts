import { NextResponse, type NextRequest } from "next/server";

import { devPrincipal, getWebAuthConfig } from "../../../lib/auth/config";
import { sanitizeRedirectPath } from "../../../lib/auth/oidc";
import { setSessionCookie } from "../../../lib/auth/session";

export async function POST(request: NextRequest) {
  if (!getWebAuthConfig().devEnabled) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "dev_disabled");
    return NextResponse.redirect(url, 303);
  }
  const formData = await request.formData();
  const role = formData.get("role") === "admin" ? "admin" : "user";
  const nextPath = sanitizeRedirectPath(typeof formData.get("next") === "string" ? String(formData.get("next")) : undefined);
  const response = NextResponse.redirect(new URL(nextPath, request.url), 303);
  setSessionCookie(response, request, devPrincipal(role));
  return response;
}
