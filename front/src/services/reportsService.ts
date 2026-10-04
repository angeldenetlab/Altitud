import { apiPost } from "@/lib/api";
import type { ReportsData } from "@/types/altitude";

export const reportsService = {
  /** Rentabilidad por proyecto y por tipo de servicio. [R-30] [R-31] */
  async overview(): Promise<ReportsData> {
    return apiPost<ReportsData>("/api/erp/reports", { action: "overview" });
  },
};
