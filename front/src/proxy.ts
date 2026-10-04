import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSessionToken } from "@/lib/auth/server-session";

const publicRoutes = ["/login"];
const publicPrefixes = ["/api/"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = isValidSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    if (hasSession) {
      return NextResponse.redirect(new URL("/panel", request.url));
    }
    return NextResponse.next();
  }

  if (publicPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
