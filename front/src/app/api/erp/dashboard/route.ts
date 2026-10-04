import { erpError, type Payload } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { handleDashboard } from "@/server/erp/dashboard";

interface ActionBody {
  action?: string;
  payload?: Payload;
}

/**
 * BFF del panel.
 *
 * Acción: overview. Solo lectura: los números salen de los mismos proyectos,
 * cotizaciones y asistencias que alimentan el resto. [R-29]
 *
 * Contrato de red: POST { action, payload }. Las pantallas y los servicios
 * no cambian: solo cambia de dónde salen los datos.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ActionBody;
    const action = body.action ?? "overview";
    const payload = body.payload ?? {};

    const guard = await requireSession("panel.read");
    if ("denied" in guard) return guard.denied;

    return await handleDashboard(action, payload, guard.session);
  } catch (error) {
    return erpError("BFF panel", error);
  }
}
