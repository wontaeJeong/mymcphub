import { NextResponse, type NextRequest } from "next/server";

import { findOidcProvider, oidcClaimsToPrincipal } from "../../../../../lib/auth/config";
import { discoverOidc, exchangeAuthorizationCode, fetchUserInfo, sanitizeRedirectPath, verifyIdToken } from "../../../../../lib/auth/oidc";
import { transactionCookieName, verifyTransactionToken } from "../../../../../lib/auth/transaction";
import { clearSessionCookie, setSessionCookie } from "../../../../../lib/auth/session";

export async function GET(request: NextRequest, { params }: Readonly<{ params: Promise<{ providerId: string }> }>) {
  const { providerId } = await params;
  const provider = findOidcProvider(providerId);
  if (!provider) {
    return loginError(request, "provider_unavailable");
  }
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const code = request.nextUrl.searchParams.get("code") ?? "";
  const transaction = verifyTransactionToken(request.cookies.get(transactionCookieName(provider.id))?.value, state);
  if (!state || !code || !transaction || transaction.providerId !== provider.id) {
    return loginError(request, "oidc_state_invalid");
  }
  try {
    const discovery = await discoverOidc(provider);
    const tokens = await exchangeAuthorizationCode(provider, discovery, code, transaction.codeVerifier);
    if (!tokens.id_token) {
      return loginError(request, "oidc_callback_failed");
    }
    const claims = await verifyIdToken(provider, discovery, tokens.id_token, transaction.nonce);
    const userInfo = await fetchUserInfo(discovery, tokens.access_token);
    const response = NextResponse.redirect(new URL(sanitizeRedirectPath(transaction.nextPath), request.url));
    response.cookies.set({ name: transactionCookieName(provider.id), value: "", path: "/", maxAge: 0 });
    setSessionCookie(response, request, oidcClaimsToPrincipal(provider, { ...claims, ...userInfo }));
    return response;
  } catch {
    return loginError(request, "oidc_callback_failed");
  }
}

function loginError(request: NextRequest, error: string) {
  const response = NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, request.url));
  clearSessionCookie(response);
  return response;
}
