import { erpError, type Payload } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { handleQuotes } from "@/server/erp/quotes";
import type { PermissionCode } from "@/types/rbac";

/** Acciones que modifican datos: exigen permiso de escritura. [R-33] */
const WRITE_ACTIONS = new Set([
  "create",
  "createFromProject",
  "saveLines",
  "saveSurvey",
  "setStatus",
]);

/** Acciones con un permiso propio. */
const SPECIAL_ACTIONS: Record<string, PermissionCode> = {
  authorize: "cotizaciones.approve",
  reject: "cotizaciones.approve",
};

interface ActionBody {
  action?: string;
  payload?: Payload;
}

/**
 * BFF de cotizaciones.
 *
 * Acciones: list | get | services | create | createFromProject |
 * pendingExtras | saveLines | saveSurvey | setStatus | authorize | reject
 *
 * La cotización es un `sale.order`; autorizar lo confirma y, si nació como
 * prospecto, abre el proyecto con su presupuesto base.
 *
 * Contrato de red: POST { action, payload }. Las pantallas y los servicios
 * no cambian: solo cambia de dónde salen los datos.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ActionBody;
    const action = body.action ?? "list";
    const payload = body.payload ?? {};

    const guard = await requireSession(
      SPECIAL_ACTIONS[action] ??
        (WRITE_ACTIONS.has(action) ? "cotizaciones.write" : "cotizaciones.read"),
    );
    if ("denied" in guard) return guard.denied;

    return await handleQuotes(action, payload, guard.session);
  } catch (error) {
    return erpError("BFF cotizaciones", error);
  }
}
