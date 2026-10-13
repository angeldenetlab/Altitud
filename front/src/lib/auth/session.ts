import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Sesión del portal: cookie httpOnly firmada con `AUTH_SECRET`.
 *
 * Guarda quién entró y, sobre todo, **qué colaborador es**: el portal se
 * ordena por `hr.employee`, no por usuario. Las escrituras en Odoo las hace
 * la cuenta técnica, así que el empleado de la sesión es la única firma que
 * queda del lado de Altitud (`surveyed_by_id`).
 */

export const SESSION_COOKIE = "altitud_portal";
export const SESSION_MAX_AGE = 60 * 60 * 12;

export interface SessionPayload {
  /** `res.users.id` de quien entró. */
  uid: number;
  login: string;
  name: string;
  /** `hr.employee.id` ligado al usuario. Sin él no hay portal. */
  employeeId: number;
  employeeName: string;
  companyId: number;
  companyName: string;
  exp: number;
}

function getSessionSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret?.trim()) {
    throw new Error("Falta AUTH_SECRET. Genera uno con: openssl rand -hex 32");
  }
  return secret;
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");
}

export function createSessionToken(input: Omit<SessionPayload, "exp">): string {
  const payload = Buffer.from(
    JSON.stringify({ ...input, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE }),
    "utf8",
  ).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

export function parseSessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = Buffer.from(signPayload(encodedPayload));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (
      typeof parsed.uid !== "number" ||
      typeof parsed.employeeId !== "number" ||
      typeof parsed.name !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Sesión del request, o null. Las pantallas y las acciones la vuelven a exigir. */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return parseSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax" as const,
    maxAge: SESSION_MAX_AGE,
    path: "/",
  };
}
