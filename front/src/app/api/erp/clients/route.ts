import { erpError, type Payload } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { handleClients } from "@/server/erp/clients";

/** Acciones que modifican datos: exigen permiso de escritura. [R-33] */
const WRITE_ACTIONS = new Set([
  "create",
  "update",
]);

interface ActionBody {
  action?: string;
  payload?: Payload;
}

/**
 * BFF de clientes.
 *
 * Acciones: list | get | create | update
 *
 * El cliente es `res.partner` con `customer_rank > 0` y folio propio.
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
      WRITE_ACTIONS.has(action) ? "clientes.write" : "clientes.read",
    );
    if ("denied" in guard) return guard.denied;

    return await handleClients(action, payload, guard.session);
  } catch (error) {
    return erpError("BFF clientes", error);
  }
}
