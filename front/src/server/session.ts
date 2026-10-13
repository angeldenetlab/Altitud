import { redirect } from "next/navigation";
import { type SessionPayload, getSession } from "@/lib/auth/session";

/**
 * Sesión obligatoria. Las pantallas y las acciones la vuelven a exigir: el
 * `proxy` solo mira que la cookie exista, no que sea válida.
 */
export async function requireSession(nextPath?: string): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    const target = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
    redirect(target);
  }
  return session;
}
