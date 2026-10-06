import { apiPost } from "@/lib/api";
import type {
  CrewMember,
  ProjectListParams,
  ProjectRow,
  ProjectStage,
} from "@/types/altitude";

const ENDPOINT = "/api/erp/projects";

type ListResult = {
  rows: ProjectRow[];
  total: number;
  active: number;
  contracted: number;
  actual: number;
};

export const projectsService = {
  /** Directorio único con folio para todo trabajo. [R-01] */
  async list(params: ProjectListParams = {}): Promise<ListResult> {
    return apiPost<ListResult>(ENDPOINT, { action: "list", payload: params });
  },
  async get(id: number): Promise<ProjectRow | null> {
    return apiPost<ProjectRow | null>(ENDPOINT, { action: "get", payload: { id } });
  },
  async stages(): Promise<{ rows: { stage: ProjectStage; label: string }[] }> {
    return apiPost(ENDPOINT, { action: "stages" });
  },
  async create(payload: Record<string, unknown>): Promise<ProjectRow> {
    return apiPost<ProjectRow>(ENDPOINT, { action: "create", payload });
  },
  async update(payload: Record<string, unknown>): Promise<ProjectRow> {
    return apiPost<ProjectRow>(ENDPOINT, { action: "update", payload });
  },
  /** Mover de etapa (kanban). */
  async setStage(id: number, stage: ProjectStage): Promise<ProjectRow> {
    return apiPost<ProjectRow>(ENDPOINT, { action: "setStage", payload: { id, stage } });
  },
  /** Presupuesto base por partidas. [R-03] */
  async saveBudget(id: number, lines: Record<string, unknown>[]): Promise<ProjectRow> {
    return apiPost<ProjectRow>(ENDPOINT, { action: "saveBudget", payload: { id, lines } });
  },
  /** Gasto real capturado a mano. [R-04] */
  async addActual(payload: Record<string, unknown>): Promise<ProjectRow> {
    return apiPost<ProjectRow>(ENDPOINT, { action: "addActual", payload });
  },
  /** Gasto desde campo. [R-27] */
  async addFieldExpense(payload: Record<string, unknown>): Promise<ProjectRow> {
    return apiPost<ProjectRow>(ENDPOINT, { action: "addFieldExpense", payload });
  },
  /**
   * Padrón activo para elegir responsable de fase. No filtra por cuadrilla
   * ni por asistencia.
   */
  async employees(): Promise<{ rows: { id: number; name: string; job: string }[] }> {
    return apiPost(ENDPOINT, { action: "employees" });
  },
  /** Avance por fase. [R-05] */
  async setPhase(payload: Record<string, unknown>): Promise<ProjectRow> {
    return apiPost<ProjectRow>(ENDPOINT, { action: "setPhase", payload });
  },
  /** Extras y faltantes. [R-06] */
  async addExtra(payload: Record<string, unknown>): Promise<ProjectRow> {
    return apiPost<ProjectRow>(ENDPOINT, { action: "addExtra", payload });
  },
  /** Evidencia fotográfica. [R-26] */
  async addEvidence(payload: Record<string, unknown>): Promise<ProjectRow> {
    return apiPost<ProjectRow>(ENDPOINT, { action: "addEvidence", payload });
  },
  /** Cierre con comparativo y rentabilidad. [R-07] */
  async close(payload: Record<string, unknown>): Promise<ProjectRow> {
    return apiPost<ProjectRow>(ENDPOINT, { action: "close", payload });
  },
  async reopen(id: number): Promise<ProjectRow> {
    return apiPost<ProjectRow>(ENDPOINT, { action: "reopen", payload: { id } });
  },

  /**
   * Cuadrilla: quién de la plantilla presta servicio en este proyecto. Es lo
   * que habilita marcar asistencia. [R-19]
   */
  async crew(projectId: number): Promise<{ rows: CrewMember[]; total: number }> {
    return apiPost(ENDPOINT, { action: "crew", payload: { id: projectId } });
  },
  async assignCrew(projectId: number, employeeIds: number[]): Promise<{ rows: CrewMember[] }> {
    return apiPost(ENDPOINT, {
      action: "assignCrew",
      payload: { id: projectId, employee_ids: employeeIds },
    });
  },
  async unassignCrew(projectId: number, employeeId: number): Promise<{ rows: CrewMember[] }> {
    return apiPost(ENDPOINT, {
      action: "unassignCrew",
      payload: { id: projectId, employee_id: employeeId },
    });
  },
};
