"use server";

import { revalidatePath } from "next/cache";
import { OdooError, read } from "@/lib/odoo/client";
import { requireSession } from "@/server/session";
import {
  addPhoto,
  assignToEmployee,
  closeSurvey,
  removePhoto,
  reopenSurvey,
  saveCapture,
} from "@/server/surveys";
import type { CaptureValues } from "@/types/survey";

/**
 * Lo que el empleado puede hacer desde el celular: asignarse, capturar y
 * cerrar. Cada acción vuelve a exigir sesión y vuelve a preguntarle a Odoo de
 * quién es el levantamiento: la pantalla no es la que manda.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const FOTO_MAX_BYTES = 8 * 1024 * 1024;

function failed(error: unknown): ActionResult {
  const message =
    error instanceof OdooError ? error.message : "No se pudo guardar. Revisa tu conexión.";
  return { ok: false, error: message };
}

/** Un levantamiento solo se captura si está asignado a quien lo abre y sigue abierto. */
async function assertEditable(surveyId: number, employeeId: number): Promise<void> {
  const records = await read<{
    id: number;
    state: string;
    employee_id: [number, string] | false;
  }>("altitud.survey", [surveyId], ["id", "state", "employee_id"]);
  const record = records[0];
  if (!record) throw new OdooError("Ese levantamiento ya no existe.", 404);
  if (!record.employee_id || record.employee_id[0] !== employeeId) {
    throw new OdooError("Este levantamiento es de otro compañero. Asígnatelo para capturar.", 403);
  }
  if (record.state === "listo") {
    throw new OdooError("El levantamiento ya está cerrado. Reábrelo para corregirlo.", 400);
  }
}

function refresh(surveyId: number): void {
  revalidatePath("/levantamientos");
  revalidatePath(`/levantamientos/${surveyId}`);
}

export async function saveCaptureAction(
  surveyId: number,
  values: CaptureValues,
): Promise<ActionResult> {
  const session = await requireSession();
  try {
    await assertEditable(surveyId, session.employeeId);
    await saveCapture(surveyId, values);
    refresh(surveyId);
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}

export async function assignToMeAction(surveyId: number): Promise<ActionResult> {
  const session = await requireSession();
  try {
    const records = await read<{ id: number; state: string }>(
      "altitud.survey",
      [surveyId],
      ["id", "state"],
    );
    if (!records[0]) throw new OdooError("Ese levantamiento ya no existe.", 404);
    if (records[0].state === "listo") {
      throw new OdooError("Ese levantamiento ya está cerrado.", 400);
    }
    await assignToEmployee(surveyId, session.employeeId);
    refresh(surveyId);
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}

export async function closeSurveyAction(
  surveyId: number,
  values: CaptureValues,
): Promise<ActionResult> {
  const session = await requireSession();
  try {
    await assertEditable(surveyId, session.employeeId);
    await closeSurvey(surveyId, session.employeeId, values);
    refresh(surveyId);
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}

export async function reopenSurveyAction(surveyId: number): Promise<ActionResult> {
  const session = await requireSession();
  try {
    const records = await read<{ id: number; employee_id: [number, string] | false }>(
      "altitud.survey",
      [surveyId],
      ["id", "employee_id"],
    );
    const record = records[0];
    if (!record) throw new OdooError("Ese levantamiento ya no existe.", 404);
    if (!record.employee_id || record.employee_id[0] !== session.employeeId) {
      throw new OdooError("Ese levantamiento es de otro compañero.", 403);
    }
    await reopenSurvey(surveyId);
    refresh(surveyId);
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}

/** Una foto por llamada: en campo la señal se va y conviene reintentar de a una. */
export async function uploadPhotoAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const surveyId = Number(formData.get("surveyId"));
  const file = formData.get("photo");

  try {
    if (!Number.isInteger(surveyId)) throw new OdooError("Levantamiento inválido.", 400);
    if (!(file instanceof File) || file.size === 0) {
      throw new OdooError("No llegó la foto. Intenta otra vez.", 400);
    }
    if (file.size > FOTO_MAX_BYTES) {
      throw new OdooError("La foto pesa demasiado. Tómala de nuevo desde el portal.", 400);
    }
    await assertEditable(surveyId, session.employeeId);

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    await addPhoto(surveyId, {
      name: file.name || `foto-${Date.now()}.jpg`,
      mimetype: file.type || "image/jpeg",
      base64,
    });
    refresh(surveyId);
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}

export async function deletePhotoAction(
  surveyId: number,
  attachmentId: number,
): Promise<ActionResult> {
  const session = await requireSession();
  try {
    await assertEditable(surveyId, session.employeeId);
    await removePhoto(surveyId, attachmentId);
    refresh(surveyId);
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}
