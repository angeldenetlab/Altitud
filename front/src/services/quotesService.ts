import { apiPost } from "@/lib/api";
import type { Quote, QuoteListParams, QuoteStatus, ServiceItem } from "@/types/altitude";

const ENDPOINT = "/api/erp/quotes";

type ListResult = {
  rows: Quote[];
  total: number;
  pending: number;
  authorized: number;
  amount_pending: number;
};

export const quotesService = {
  /** Seguimiento por folio y estatus. [R-15] */
  async list(params: QuoteListParams = {}): Promise<ListResult> {
    return apiPost<ListResult>(ENDPOINT, { action: "list", payload: params });
  },
  async get(id: number): Promise<Quote | null> {
    return apiPost<Quote | null>(ENDPOINT, { action: "get", payload: { id } });
  },
  /** Catálogo de servicios con precio paramétrico. [R-10] [R-16] */
  async services(): Promise<{ rows: ServiceItem[] }> {
    return apiPost(ENDPOINT, { action: "services" });
  },
  async create(payload: Record<string, unknown>): Promise<Quote> {
    return apiPost<Quote>(ENDPOINT, { action: "create", payload });
  },
  async saveLines(id: number, lines: Record<string, unknown>[], overheadPct?: number): Promise<Quote> {
    return apiPost<Quote>(ENDPOINT, {
      action: "saveLines",
      payload: { id, lines, overhead_pct: overheadPct },
    });
  },
  /** Levantamiento delegable con fotos y medidas. [R-11] */
  async saveSurvey(payload: Record<string, unknown>): Promise<Quote> {
    return apiPost<Quote>(ENDPOINT, { action: "saveSurvey", payload });
  },
  /** Flujo de autorización interna. [R-13] */
  async setStatus(id: number, status: QuoteStatus, comment?: string): Promise<Quote> {
    return apiPost<Quote>(ENDPOINT, { action: "setStatus", payload: { id, status, comment } });
  },
  /** Autorizar genera el proyecto con su presupuesto. [R-15] */
  async authorize(payload: Record<string, unknown>): Promise<{
    quote: Quote;
    project_id: number;
    project_folio: string;
  }> {
    return apiPost(ENDPOINT, { action: "authorize", payload });
  },
  /**
   * Generar una cotización para el cliente desde un proyecto en marcha:
   * extras de obra, trabajo adicional o la cotización inicial. [R-06] [R-09]
   */
  async createFromProject(payload: Record<string, unknown>): Promise<Quote> {
    return apiPost<Quote>(ENDPOINT, { action: "createFromProject", payload });
  },
  /** Extras cobrables que aún no se le cotizan al cliente. [R-06] */
  async pendingExtras(projectId: number): Promise<{
    rows: { id: number; concept: string; category: string; amount: number; date: string }[];
  }> {
    return apiPost(ENDPOINT, { action: "pendingExtras", payload: { project_id: projectId } });
  },
  async reject(id: number, comment?: string): Promise<Quote> {
    return apiPost<Quote>(ENDPOINT, { action: "reject", payload: { id, comment } });
  },
};
