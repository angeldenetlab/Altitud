import { apiPost } from "@/lib/api";
import type { FieldExpense, Purchase, PurchaseListParams, Supply } from "@/types/altitude";

const ENDPOINT = "/api/erp/purchases";

export const purchasesService = {
  /** Compras cargadas al proyecto. [R-23] */
  async list(params: PurchaseListParams = {}): Promise<{
    rows: Purchase[];
    total: number;
    amount: number;
    sin_factura: number;
    por_pagar: number;
  }> {
    return apiPost(ENDPOINT, { action: "list", payload: params });
  },
  async create(payload: Record<string, unknown>): Promise<Purchase> {
    return apiPost<Purchase>(ENDPOINT, { action: "create", payload });
  },
  async setStatus(payload: Record<string, unknown>): Promise<Purchase> {
    return apiPost<Purchase>(ENDPOINT, { action: "setStatus", payload });
  },
  /** Conteo básico de insumos. [R-25] */
  async supplies(search?: string): Promise<{ rows: Supply[]; total: number; to_reorder: number }> {
    return apiPost(ENDPOINT, { action: "supplies", payload: { search } });
  },
  async countSupply(payload: Record<string, unknown>): Promise<Supply> {
    return apiPost<Supply>(ENDPOINT, { action: "countSupply", payload });
  },
  /** Gastos capturados desde campo. [R-27] */
  async expenses(projectId?: number): Promise<{ rows: FieldExpense[]; total: number; amount: number }> {
    return apiPost(ENDPOINT, { action: "expenses", payload: { project_id: projectId } });
  },
  async suppliers(): Promise<{ rows: string[] }> {
    return apiPost(ENDPOINT, { action: "suppliers" });
  },
};
