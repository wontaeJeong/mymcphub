import { NextResponse, type NextRequest } from "next/server";

import { findOidcProvider } from "../../../../lib/auth/config";
import { authorizationUrl, discoverOidc, pkceChallenge, randomBase64Url, sanitizeRedirectPath } from "../../../../lib/auth/oidc";
import { createTransactionToken, transactionCookieName } from "../../../../lib/auth/transaction";
import { isSecureRequest } from "../../../../lib/auth/session";

export async function GET(request: NextRequest, { params }: Readonly<{ params: Promise<{ providerId: string }> }>) {
  const { providerId } = await params;
  const provider = findOidcProvider(providerId);
  if (!provider) {
    return NextResponse.redirect(new URL("/login?error=provider_unavailable", request.url));
  }
  const state = randomBase64Url(24);
  const nonce = randomBase64Url(24);
  const codeVerifier = randomBase64Url(48);
  const codeChallenge = await pkceChallenge(codeVerifier);
  const nextPath = sanitizeRedirectPath(request.nextUrl.searchParams.get("next"));
  const discovery = await discoverOidc(provider);
  const response = NextResponse.redirect(authorizationUrl(provider, discovery, state, nonce, codeChallenge, nextPath));
  response.cookies.set({
    name: transactionCookieName(provider.id),
    value: createTransactionToken({ providerId: provider.id, state, nonce, codeVerifier, nextPath, expiresAt: Math.floor(Date.now() / 1000) + 600 }),
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
