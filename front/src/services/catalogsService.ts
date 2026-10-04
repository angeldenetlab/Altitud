import { apiPost } from "@/lib/api";
import type { Employee, ServiceItem } from "@/types/altitude";

const ENDPOINT = "/api/erp/catalogs";

export const catalogsService = {
  /** Servicios con precio paramétrico. [R-10] [R-16] */
  async services(params: Record<string, unknown> = {}): Promise<{ rows: ServiceItem[]; total: number }> {
    return apiPost(ENDPOINT, { action: "services", payload: params });
  },
  async saveService(payload: Record<string, unknown>): Promise<ServiceItem> {
    return apiPost<ServiceItem>(ENDPOINT, { action: "saveService", payload });
  },
  async employees(params: Record<string, unknown> = {}): Promise<{
    rows: Employee[];
    total: number;
    active: number;
    jornal_avg: number;
  }> {
    return apiPost(ENDPOINT, { action: "employees", payload: params });
  },
  async saveEmployee(payload: Record<string, unknown>): Promise<Employee> {
    return apiPost<Employee>(ENDPOINT, { action: "saveEmployee", payload });
  },
  async toggleEmployee(id: number): Promise<Employee> {
    return apiPost<Employee>(ENDPOINT, { action: "toggleEmployee", payload: { id } });
  },
  /** Razones sociales. [R-37] */
  async companies(): Promise<{ rows: { code: string; name: string; rfc: string; label: string; projects: number }[] }> {
    return apiPost(ENDPOINT, { action: "companies" });
  },
  /** Usuarios y roles. [R-33] */
  async users(): Promise<{ rows: { id: number; name: string; role: string }[] }> {
    return apiPost(ENDPOINT, { action: "users" });
  },
  async areas(): Promise<{ rows: { area: string; label: string; projects: number; services: number }[] }> {
    return apiPost(ENDPOINT, { action: "areas" });
  },
};
