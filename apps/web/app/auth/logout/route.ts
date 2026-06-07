import { NextResponse, type NextRequest } from "next/server";

import { clearSessionCookie } from "../../../lib/auth/session";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login?logout=1", request.url));
  clearSessionCookie(response);
  return response;
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login?logout=1", request.url));
  clearSessionCookie(response);
  return response;
}
