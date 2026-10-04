import { erpError, type Payload } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { handlePurchases } from "@/server/erp/purchases";

/** Acciones que modifican datos: exigen permiso de escritura. [R-33] */
const WRITE_ACTIONS = new Set([
  "create",
  "setStatus",
  "countSupply",
]);

interface ActionBody {
  action?: string;
  payload?: Payload;
}

/**
 * BFF de compras.
 *
 * Acciones: list | get | create | setStatus | supplies | countSupply |
 * expenses | suppliers
 *
 * La compra es un `purchase.order` confirmado con la analítica del proyecto.
 * No escribe línea de gasto a mano: se duplicaría el día que alguien
 * contabilice la factura del proveedor.
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
      WRITE_ACTIONS.has(action) ? "compras.write" : "compras.read",
    );
    if ("denied" in guard) return guard.denied;

    return await handlePurchases(action, payload, guard.session);
  } catch (error) {
    return erpError("BFF compras", error);
  }
}
