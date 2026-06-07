import type { WebSession } from "./session";

export function defaultPathForSession(session: WebSession) {
  return session.principal.isPlatformAdmin ? "/admin" : "/user";
}

export function isProtectedPath(pathname: string) {
  return pathname === "/user" || pathname.startsWith("/user/") || pathname === "/admin" || pathname.startsWith("/admin/");
}

export function canAccessPath(pathname: string, session: WebSession | undefined) {
  if (!isProtectedPath(pathname)) {
    return true;
  }
  if (!session) {
    return false;
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return session.principal.isPlatformAdmin;
  }
  return true;
}
