import { erpError, type Payload } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { handleChatter } from "@/server/erp/chatter";
import type { PermissionCode } from "@/types/rbac";

interface ActionBody {
  action?: string;
  payload?: Payload;
}

/**
 * El permiso de la bitácora es el del registro al que cuelga, no uno propio.
 * Leer el hilo de una cotización pide `cotizaciones.read`; escribir en él,
 * `cotizaciones.write`. Si no, cualquier rol con acceso al panel podría leer
 * la bitácora de un cliente o publicar en una cotización que ni siquiera ve.
 */
const READ_BY_MODEL: Record<string, PermissionCode> = {
  project: "proyectos.read",
  quote: "cotizaciones.read",
  client: "clientes.read",
};

const WRITE_BY_MODEL: Record<string, PermissionCode> = {
  project: "proyectos.write",
  quote: "cotizaciones.write",
  client: "clientes.write",
};

/** Publicar, programar y cerrar actividades son escrituras. */
const WRITE_ACTIONS = new Set(["post", "schedule", "done"]);

function permissionFor(action: string, payload: Payload): PermissionCode {
  // `done` no trae modelo: la actividad se identifica por id. El despachador
  // valida que sea del usuario en sesión.
  if (action === "done") return "panel.read";

  const model = typeof payload.model === "string" ? payload.model : "";
  const table = WRITE_ACTIONS.has(action) ? WRITE_BY_MODEL : READ_BY_MODEL;
  // Las acciones sin registro (catálogos de tipos, usuarios, campana) solo
  // piden sesión con acceso al panel.
  return table[model] ?? "panel.read";
}

/**
 * BFF de la bitácora.
 *
 * Acciones: messages | post | activities | activityTypes | users | schedule |
 * done | notifications
 *
 * `mail.message` y `mail.activity` del registro. El historial de cambios no
 * se escribe a mano: sale del tracking nativo de Odoo.
 *
 * Contrato de red: POST { action, payload }. Las pantallas y los servicios
 * no cambian: solo cambia de dónde salen los datos.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ActionBody;
    const action = body.action ?? "messages";
    const payload = body.payload ?? {};

    const guard = await requireSession(permissionFor(action, payload));
    if ("denied" in guard) return guard.denied;

    return await handleChatter(action, payload, guard.session);
  } catch (error) {
    return erpError("BFF bitácora", error);
  }
}
