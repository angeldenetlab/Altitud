import { apiPost } from "@/lib/api";
import type { DashboardData } from "@/types/altitude";

export const dashboardService = {
  /** Tablero de proyectos activos. [R-29] */
  async overview(): Promise<DashboardData> {
    return apiPost<DashboardData>("/api/erp/dashboard", { action: "overview" });
  },
};
