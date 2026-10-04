import { erpError, type Payload } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { handleAttendance } from "@/server/erp/attendance";

/** Acciones que modifican datos: exigen permiso de escritura. [R-33] */
const WRITE_ACTIONS = new Set([
  "create",
  "createBatch",
  "reassign",
  "setKind",
  "remove",
]);

interface ActionBody {
  action?: string;
  payload?: Payload;
}

/**
 * BFF de asistencias.
 *
 * Acciones: board | list | employees | create | createBatch | reassign |
 * setKind | remove | kinds
 *
 * La asistencia es `hr.attendance` con jornada y proyecto. El costo de mano
 * de obra lo mantiene el ERP: la asistencia lleva su propia parte de horas.
 * Armar la cuadrilla es una acción de proyectos, no de aquí.
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
      WRITE_ACTIONS.has(action) ? "asistencias.write" : "asistencias.read",
    );
    if ("denied" in guard) return guard.denied;

    return await handleAttendance(action, payload, guard.session);
  } catch (error) {
    return erpError("BFF asistencias", error);
  }
}
