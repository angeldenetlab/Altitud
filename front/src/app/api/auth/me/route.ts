import { NextResponse } from "next/server";
import { getSession, toPublicAuthUser } from "@/lib/auth/server-session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: toPublicAuthUser(session),
  });
}
