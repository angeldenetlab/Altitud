import { NextResponse } from "next/server";
import { SESSION_COOKIE, isSessionCookieSecure } from "@/lib/auth/server-session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isSessionCookieSecure(),
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
