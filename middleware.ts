import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { FIREBASE_SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(FIREBASE_SESSION_COOKIE_NAME)?.value;

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/customer/:path*"],
};
