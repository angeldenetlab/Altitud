"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/auth/session";
import { OdooError, authenticate, read } from "@/lib/odoo/client";
import { findEmployeeForUser } from "@/server/surveys";

export interface LoginState {
  error: string | null;
}

/** Solo rutas del portal: el `next` viene de la barra de direcciones. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/levantamientos")) return "/levantamientos";
  return value;
}

/**
 * Entrada al portal con el usuario y la contraseña de Odoo.
 *
 * La contraseña se usa una sola vez, aquí. Todo lo demás lo hace la cuenta
 * técnica. Para entrar hacen falta dos cosas: ser usuario interno y tener un
 * colaborador (`hr.employee`) ligado, que es lo que ordena el portal.
 */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const loginName = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "") || null);

  if (!loginName || !password) {
    return { error: "Escribe tu usuario y tu contraseña." };
  }

  let token: string;
  try {
    const uid = await authenticate(loginName, password);
    if (!uid) {
      return { error: "Usuario o contraseña incorrectos." };
    }

    const users = await read<{
      id: number;
      login: string;
      name: string;
      share: boolean;
      company_id: [number, string] | false;
    }>("res.users", [uid], ["id", "login", "name", "share", "company_id"]);
    const user = users[0];

    if (!user || user.share) {
      return { error: "Tu usuario no es de la empresa. El portal es para colaboradores." };
    }

    const employee = await findEmployeeForUser(uid);
    if (!employee) {
      return {
        error:
          "Tu usuario no tiene colaborador ligado en Odoo. Pide a oficina que ligue tu empleado al usuario para entrar al portal.",
      };
    }

    token = createSessionToken({
      uid: user.id,
      login: user.login,
      name: user.name,
      employeeId: employee.id,
      employeeName: employee.name,
      companyId: user.company_id ? user.company_id[0] : 0,
      companyName: user.company_id ? user.company_id[1] : "",
    });
  } catch (error) {
    const message =
      error instanceof OdooError ? error.message : "No se pudo entrar. Intenta de nuevo.";
    return { error: message };
  }

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieOptions(token));
  redirect(next);
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
