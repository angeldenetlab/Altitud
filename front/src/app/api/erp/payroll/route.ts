import { erpError, type Payload } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { handlePayroll } from "@/server/erp/payroll";

interface ActionBody {
  action?: string;
  payload?: Payload;
}

/**
 * BFF de prenómina.
 *
 * Acciones: period | export
 *
 * Es un agregado de las asistencias del periodo por `x_jornada`. No timbra
 * y no lee la parte de horas. [R-36]
 *
 * Contrato de red: POST { action, payload }. Las pantallas y los servicios
 * no cambian: solo cambia de dónde salen los datos.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ActionBody;
    const action = body.action ?? "period";
    const payload = body.payload ?? {};

    const guard = await requireSession("prenomina.read");
    if ("denied" in guard) return guard.denied;

    return await handlePayroll(action, payload, guard.session);
  } catch (error) {
    return erpError("BFF prenómina", error);
  }
}
