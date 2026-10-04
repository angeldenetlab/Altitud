import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server-session";
import { canPerform } from "@/lib/auth/rbac";
import type { PermissionCode } from "@/types/rbac";
import type { SessionPayload } from "@/lib/auth/server-session";

/**
 * Puerta de entrada del BFF: exige sesión y, opcionalmente, el permiso del
 * rol. El front ya oculta lo que no corresponde, pero el permiso también se
 * valida aquí para que no dependa de la UI. [R-33]
 */
export async function requireSession(
  permission?: PermissionCode,
): Promise<{ denied: NextResponse } | { session: SessionPayload }> {
  const session = await getSession();
  if (!session) {
    return {
      denied: NextResponse.json(
        { error: "No autenticado: inicia sesión de nuevo." },
        { status: 401 },
      ),
    };
  }

  if (permission && !canPerform(session.role, permission)) {
    return {
      denied: NextResponse.json(
        { error: "Tu rol no tiene acceso a esta información." },
        { status: 403 },
      ),
    };
  }

  return { session };
}
