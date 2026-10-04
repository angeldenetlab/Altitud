import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { AppRole, AuthUser } from "@/types/roles";

export const SESSION_COOKIE = "altitude_session";
export const SESSION_MAX_AGE = 28800;

export interface SessionPayload {
  uid: number;
  login: string;
  name: string;
  email: string;
  role: AppRole;
  company: AuthUser["company"];
  exp: number;
}

function getSessionSecret(): string {
  return process.env.AUTH_SECRET ?? "altitude-dev-session-secret";
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");
}

function encodePayload(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(encodedPayload: string): SessionPayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (
      typeof parsed.uid !== "number" ||
      typeof parsed.login !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.role !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function createSessionToken(input: Omit<SessionPayload, "exp">): string {
  const payload = encodePayload({
    ...input,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  });
  return `${payload}.${signPayload(payload)}`;
}

export function parseSessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = signPayload(encodedPayload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  const payload = decodePayload(encodedPayload);
  if (!payload || payload.exp <= Math.floor(Date.now() / 1000)) return null;

  return payload;
}

export function isValidSessionToken(token: string | undefined | null): boolean {
  return parseSessionToken(token) !== null;
}

export function toPublicAuthUser(session: SessionPayload): AuthUser {
  return {
    id: String(session.uid),
    name: session.name,
    email: session.email,
    role: session.role,
    company: session.company,
  };
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return parseSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export function isSessionCookieSecure(): boolean {
  return process.env.COOKIE_SECURE === "true";
}

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: isSessionCookieSecure(),
    sameSite: "lax" as const,
    maxAge: SESSION_MAX_AGE,
    path: "/",
  };
}
