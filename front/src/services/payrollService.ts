import { apiPost } from "@/lib/api";
import type { PayrollPeriod } from "@/types/altitude";

const ENDPOINT = "/api/erp/payroll";

type PeriodResult = PayrollPeriod & {
  by_company: { company: string; amount: number; people: number }[];
};

export const payrollService = {
  /** Prenómina del periodo para el despacho contable. [R-36] */
  async period(from?: string, to?: string): Promise<PeriodResult> {
    return apiPost<PeriodResult>(ENDPOINT, { action: "period", payload: { from, to } });
  },
  async exportRows(from?: string, to?: string): Promise<{
    from: string;
    to: string;
    header: string;
    rows: string[];
    count: number;
    note: string;
  }> {
    return apiPost(ENDPOINT, { action: "export", payload: { from, to } });
  },
};
