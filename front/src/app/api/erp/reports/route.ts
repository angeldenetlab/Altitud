import { erpError, type Payload } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { handleReports } from "@/server/erp/reports";

interface ActionBody {
  action?: string;
  payload?: Payload;
}

/**
 * BFF de reportes.
 *
 * Acción: overview. Usa el mismo criterio de margen que el cierre del
 * proyecto, si no las dos pantallas se contradicen. [R-30] [R-31]
 *
 * Contrato de red: POST { action, payload }. Las pantallas y los servicios
 * no cambian: solo cambia de dónde salen los datos.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ActionBody;
    const action = body.action ?? "overview";
    const payload = body.payload ?? {};

    const guard = await requireSession("reportes.read");
    if ("denied" in guard) return guard.denied;

    return await handleReports(action, payload, guard.session);
  } catch (error) {
    return erpError("BFF reportes", error);
  }
}
