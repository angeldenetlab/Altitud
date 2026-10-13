import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
/** Igual que en `src/lib/auth/session.ts`. Aquí va suelto para no arrastrar
 * `node:crypto` ni `next/headers` al corte de rutas. */
const SESSION_COOKIE = "altitud_portal";

/**
 * Corte de rutas. Solo mira que la cookie exista, para no gastar un viaje de
 * red en cada navegación; la firma la revisa cada pantalla y cada acción con
 * `requireSession`.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/login")) {
    if (hasCookie) return NextResponse.redirect(new URL("/levantamientos", request.url));
    return NextResponse.next();
  }

  if (!hasCookie) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|.*\\..*).*)"],
};
