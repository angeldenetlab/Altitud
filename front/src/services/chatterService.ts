import { apiPost } from "@/lib/api";
import type { ChatterActivity, ChatterMessage, NotificationsResult } from "@/types/altitude";

const ENDPOINT = "/api/erp/chatter";

/** `model` es "project" o "quote"; el BFF lo traduce al modelo del ERP. */
export const chatterService = {
  async messages(model: string, resId: number): Promise<{ rows: ChatterMessage[] }> {
    return apiPost(ENDPOINT, { action: "messages", payload: { model, res_id: resId } });
  },
  async post(payload: Record<string, unknown>): Promise<{ rows: ChatterMessage[] }> {
    return apiPost(ENDPOINT, { action: "post", payload });
  },
  async activities(model: string, resId: number): Promise<{ rows: ChatterActivity[] }> {
    return apiPost(ENDPOINT, { action: "activities", payload: { model, res_id: resId } });
  },
  async activityTypes(): Promise<{ rows: { id: number; name: string }[] }> {
    return apiPost(ENDPOINT, { action: "activityTypes" });
  },
  async users(): Promise<{ rows: { id: number; name: string; role: string }[] }> {
    return apiPost(ENDPOINT, { action: "users" });
  },
  /** Programar una actividad = delegar el siguiente paso. */
  async schedule(payload: Record<string, unknown>): Promise<{ rows: ChatterActivity[] }> {
    return apiPost(ENDPOINT, { action: "schedule", payload });
  },
  async done(id: number, note?: string): Promise<{ ok: boolean }> {
    return apiPost(ENDPOINT, { action: "done", payload: { id, note } });
  },
  async notifications(): Promise<NotificationsResult> {
    return apiPost<NotificationsResult>(ENDPOINT, { action: "notifications" });
  },
};
