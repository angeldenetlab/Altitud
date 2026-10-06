import { erpError, type Payload } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { handleProjects } from "@/server/erp/projects";
import type { PermissionCode } from "@/types/rbac";

/** Acciones que modifican datos: exigen permiso de escritura. [R-33] */
const WRITE_ACTIONS = new Set([
  "create",
  "update",
  "setStage",
  "saveBudget",
  "addActual",
  "addFieldExpense",
  "setPhase",
  "addExtra",
  "addEvidence",
  "assignCrew",
  "unassignCrew",
]);

/** Acciones con un permiso propio. */
const SPECIAL_ACTIONS: Record<string, PermissionCode> = {
  close: "proyectos.close",
  reopen: "proyectos.close",
};

interface ActionBody {
  action?: string;
  payload?: Payload;
}

/**
 * BFF de proyectos.
 *
 * Acciones: list | get | stages | employees | create | update | setStage |
 * saveBudget | addActual | addFieldExpense | setPhase | addExtra | addEvidence |
 * close | reopen | crew | assignCrew | unassignCrew
 *
 * `employees` es el padrón activo para elegir responsable de fase. No filtra
 * por cuadrilla ni por asistencia.
 *
 * El proyecto es `project.project` con su cuenta analítica. Armar la
 * cuadrilla vive aquí, en la ficha del proyecto, y es lo que habilita la
 * captura de asistencia.
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
        (WRITE_ACTIONS.has(action) ? "proyectos.write" : "proyectos.read"),
    );
    if ("denied" in guard) return guard.denied;

    return await handleProjects(action, payload, guard.session);
  } catch (error) {
    return erpError("BFF proyectos", error);
  }
}
