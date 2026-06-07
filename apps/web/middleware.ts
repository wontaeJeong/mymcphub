import { NextResponse, type NextRequest } from "next/server";

import { getWebAuthConfig } from "./lib/auth/config";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!isAuthCheckedPath(pathname)) {
    return NextResponse.next();
  }
  const session = readUnverifiedSession(request);
  if (pathname === "/login" && session.present) {
    return NextResponse.redirect(new URL(session.isPlatformAdmin ? "/admin" : "/user", request.url));
  }
  if ((pathname === "/user" || pathname.startsWith("/user/") || pathname === "/admin" || pathname.startsWith("/admin/")) && !session.present) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && !session.isPlatformAdmin) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/user/:path*", "/admin/:path*"],
};

function isAuthCheckedPath(pathname: string) {
  return pathname === "/login" || pathname === "/user" || pathname.startsWith("/user/") || pathname === "/admin" || pathname.startsWith("/admin/");
}

function readUnverifiedSession(request: NextRequest) {
  const token = request.cookies.get(getWebAuthConfig().sessionCookieName)?.value;
  if (!token) {
    return { present: false, isPlatformAdmin: false };
  }
  const payload = token.split(".")[0];
  if (!payload) {
    return { present: true, isPlatformAdmin: false };
  }
  try {
    const decoded = JSON.parse(base64UrlDecode(payload)) as { principal?: { isPlatformAdmin?: boolean }; expiresAt?: number };
    return { present: Boolean(decoded.expiresAt && decoded.expiresAt > Math.floor(Date.now() / 1000)), isPlatformAdmin: decoded.principal?.isPlatformAdmin === true };
  } catch {
    return { present: true, isPlatformAdmin: false };
  }
}

function base64UrlDecode(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}
