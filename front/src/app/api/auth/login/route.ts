import { NextResponse } from "next/server";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth/server-session";
import { normalizeAppRole } from "@/lib/auth/roles";
import { authenticate, m2oId, searchRead, type Many2One } from "@/lib/odoo/client";
import { erpError } from "@/lib/http";
import { companyCodeOf } from "@/server/erp/common";
import type { AppRole, AuthUser } from "@/types/roles";

interface LoginRequest {
  login?: string;
  password?: string;
}

function setSessionCookie(response: NextResponse, token: string) {
  const cookie = sessionCookieOptions(token);
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    maxAge: cookie.maxAge,
    path: cookie.path,
  });
}

/**
 * Autenticación contra `res.users` de Odoo. [R-33]
 *
 * La contraseña solo se usa aquí, para validar quién entra. A partir de ese
 * momento el BFF habla con el ERP con su cuenta técnica y los permisos los
 * exige la matriz de `src/lib/auth/rbac.ts` en cada Route Handler.
 *
 * El rol sale de `x_app_role` del usuario. Si el usuario no lo trae, se
 * entra con el perfil más acotado que deja trabajar (`control`), nunca con
 * el de socio: un rol mal configurado no debe abrir el cierre de proyectos.
 */
export async function POST(request: Request) {
  let body: LoginRequest;

  try {
    body = (await request.json()) as LoginRequest;
  } catch {
    return NextResponse.json({ error: "Payload JSON inválido" }, { status: 400 });
  }

  const login = body.login?.trim();
  const password = body.password ?? "";

  if (!login || !password) {
    return NextResponse.json(
      { error: "Usuario y contraseña son obligatorios" },
      { status: 400 },
    );
  }

  try {
    const uid = await authenticate(login, password);
    if (!uid) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos." },
        { status: 401 },
      );
    }

    const users = await searchRead<{
      id: number;
      name: string;
      login: string;
      email: string | false;
      x_app_role: AppRole | false;
      company_id: Many2One;
      share: boolean;
    }>("res.users", [["id", "=", uid]], {
      fields: ["id", "name", "login", "email", "x_app_role", "company_id", "share"],
    });

    const odooUser = users[0];
    if (!odooUser || odooUser.share) {
      return NextResponse.json(
        { error: "Ese usuario no tiene acceso al sistema de control de proyectos." },
        { status: 403 },
      );
    }

    const role = normalizeAppRole(odooUser.x_app_role || "control");
    const company = await companyCodeOf(m2oId(odooUser.company_id));

    const token = createSessionToken({
      uid: odooUser.id,
      login: odooUser.login,
      name: odooUser.name,
      email: odooUser.email || odooUser.login,
      role,
      company,
    });

    const user: AuthUser = {
      id: String(odooUser.id),
      name: odooUser.name,
      email: odooUser.email || odooUser.login,
      role,
      company,
    };

    const response = NextResponse.json({ user });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return erpError("BFF login", error);
  }
}
