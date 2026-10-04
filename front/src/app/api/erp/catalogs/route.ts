import { erpError, type Payload } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { handleCatalogs } from "@/server/erp/catalogs";

/** Acciones que modifican datos: exigen permiso de escritura. [R-33] */
const WRITE_ACTIONS = new Set([
  "saveService",
  "saveEmployee",
  "toggleEmployee",
]);

interface ActionBody {
  action?: string;
  payload?: Payload;
}

/**
 * BFF de catálogos.
 *
 * Acciones: services | saveService | employees | saveEmployee |
 * toggleEmployee | companies | users | areas | activityTypes
 *
 * Servicios son `product.product` de tipo servicio con rendimiento propio;
 * el personal es `hr.employee` con su jornal.
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
      WRITE_ACTIONS.has(action) ? "catalogos.write" : "catalogos.read",
    );
    if ("denied" in guard) return guard.denied;

    return await handleCatalogs(action, payload, guard.session);
  } catch (error) {
    return erpError("BFF catálogos", error);
  }
}
