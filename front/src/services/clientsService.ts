import { apiPost } from "@/lib/api";
import type { Client, ClientDetail, ClientListParams } from "@/types/altitude";

const ENDPOINT = "/api/erp/clients";

type ListResult = {
  rows: Client[];
  total: number;
  active: number;
  with_active_projects: number;
};

export const clientsService = {
  async list(params: ClientListParams = {}): Promise<ListResult> {
    return apiPost<ListResult>(ENDPOINT, { action: "list", payload: params });
  },
  async get(id: number): Promise<ClientDetail | null> {
    return apiPost<ClientDetail | null>(ENDPOINT, { action: "get", payload: { id } });
  },
  async create(payload: Record<string, unknown>): Promise<Client> {
    return apiPost<Client>(ENDPOINT, { action: "create", payload });
  },
  async update(payload: Record<string, unknown>): Promise<Client> {
    return apiPost<Client>(ENDPOINT, { action: "update", payload });
  },
};
