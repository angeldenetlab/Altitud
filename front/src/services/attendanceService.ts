import { apiPost } from "@/lib/api";
import type {
  Attendance,
  AttendanceBoard,
  AttendanceKind,
  AttendanceListParams,
  Employee,
} from "@/types/altitude";

const ENDPOINT = "/api/erp/attendance";

export const attendanceService = {
  /** Vista diaria de distribución del personal. [R-21] */
  async board(date?: string): Promise<AttendanceBoard & { is_workday: boolean }> {
    return apiPost(ENDPOINT, { action: "board", payload: { date } });
  },
  async list(params: AttendanceListParams = {}): Promise<{
    rows: Attendance[];
    total: number;
    cost: number;
    jornales: number;
  }> {
    return apiPost(ENDPOINT, { action: "list", payload: params });
  },
  /**
   * Personal para capturar. Con `projectId` devuelve la cuadrilla de esa
   * obra, que es lo único que se puede marcar. [R-19]
   */
  async employees(search?: string, area?: string, projectId?: number): Promise<{ rows: Employee[] }> {
    return apiPost(ENDPOINT, {
      action: "employees",
      payload: { search, area, project_id: projectId },
    });
  },
  /** Asistencia ligada a un proyecto. [R-17] [R-19] */
  async create(payload: Record<string, unknown>): Promise<Attendance> {
    return apiPost<Attendance>(ENDPOINT, { action: "create", payload });
  },
  async createBatch(payload: Record<string, unknown>): Promise<{ created: number; skipped: string[] }> {
    return apiPost(ENDPOINT, { action: "createBatch", payload });
  },
  /** Reasignar personal entre proyectos. [R-22] */
  async reassign(id: number, projectId: number): Promise<Attendance> {
    return apiPost<Attendance>(ENDPOINT, { action: "reassign", payload: { id, project_id: projectId } });
  },
  async setKind(id: number, kind: AttendanceKind): Promise<Attendance> {
    return apiPost<Attendance>(ENDPOINT, { action: "setKind", payload: { id, kind } });
  },
  async remove(id: number): Promise<{ ok: boolean }> {
    return apiPost(ENDPOINT, { action: "remove", payload: { id } });
  },
};
