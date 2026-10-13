import { OdooError, create, read, searchRead, unlink, write } from "@/lib/odoo/client";
import { todayIso } from "@/lib/format";
import {
  type Area,
  type CaptureValues,
  type Photo,
  type Survey,
  type SurveyRow,
  type SurveyState,
  missingToClose,
  parseMeasures,
  serializeMeasures,
} from "@/types/survey";

/**
 * Lecturas y escrituras del levantamiento (`altitud.survey`).
 *
 * El portal solo toca la captura de sitio y la asignación. El alta, el
 * cliente, el área y la cotización son de oficina, en Odoo.
 */

const ROW_FIELDS = [
  "id",
  "folio",
  "name",
  "sitio",
  "state",
  "employee_id",
  "partner_id",
  "area",
  "company_id",
  "survey_date",
];

const DETAIL_FIELDS = [
  ...ROW_FIELDS,
  "description",
  "floor_count",
  "measurements",
  "site_conditions",
  "surveyed_by_id",
  "photo_ids",
  "sale_order_id",
];

type Many2one = [number, string] | false;

interface SurveyRecord {
  id: number;
  folio: string | false;
  name: string | false;
  sitio: string | false;
  state: SurveyState;
  employee_id: Many2one;
  partner_id: Many2one;
  area: Area | false;
  company_id: Many2one;
  survey_date: string | false;
  description?: string | false;
  floor_count?: number;
  measurements?: string | false;
  site_conditions?: string | false;
  surveyed_by_id?: Many2one;
  photo_ids?: number[];
  sale_order_id?: Many2one;
}

const id = (value: Many2one) => (value ? value[0] : null);
const label = (value: Many2one) => (value ? value[1] : "");
const text = (value: string | false | undefined) => (typeof value === "string" ? value : "");

function toRow(record: SurveyRecord, employeeId: number): SurveyRow {
  return {
    id: record.id,
    folio: text(record.folio) || `#${record.id}`,
    name: text(record.name),
    sitio: text(record.sitio),
    state: record.state,
    employeeId: id(record.employee_id),
    employeeName: label(record.employee_id),
    partnerName: label(record.partner_id),
    area: record.area || null,
    companyName: label(record.company_id),
    surveyDate: record.survey_date || null,
    mine: id(record.employee_id) === employeeId,
  };
}

export type Scope = "mine" | "all";

/**
 * Los levantamientos del empleado, o todos los abiertos para que se asigne uno.
 * Los abiertos primero: es lo que sigue pendiente de ir a ver.
 */
export async function listSurveys(employeeId: number, scope: Scope): Promise<SurveyRow[]> {
  const domain =
    scope === "mine" ? [["employee_id", "=", employeeId]] : [["state", "=", "abierto"]];
  const records = await searchRead<SurveyRecord>("altitud.survey", domain, {
    fields: ROW_FIELDS,
    order: "state asc, id desc",
    limit: 200,
  });
  return records.map((record) => toRow(record, employeeId));
}

export async function getSurvey(surveyId: number, employeeId: number): Promise<Survey | null> {
  const records = await read<SurveyRecord>("altitud.survey", [surveyId], DETAIL_FIELDS);
  const record = records[0];
  if (!record) return null;

  return {
    ...toRow(record, employeeId),
    description: text(record.description),
    floorCount: record.floor_count ?? 0,
    measures: parseMeasures(record.measurements),
    siteConditions: text(record.site_conditions),
    surveyedByName: label(record.surveyed_by_id ?? false),
    photos: await listPhotos(record.photo_ids ?? []),
    quoteName: label(record.sale_order_id ?? false),
  };
}

async function listPhotos(attachmentIds: number[]): Promise<Photo[]> {
  if (attachmentIds.length === 0) return [];
  const attachments = await read<{
    id: number;
    name: string | false;
    mimetype: string | false;
    file_size: number;
  }>("ir.attachment", attachmentIds, ["id", "name", "mimetype", "file_size"]);
  return attachments.map((attachment) => ({
    id: attachment.id,
    name: text(attachment.name) || `Foto ${attachment.id}`,
    mimetype: text(attachment.mimetype) || "image/jpeg",
    size: attachment.file_size ?? 0,
  }));
}

/** Guarda la captura. No cambia el estado: cerrar es otra acción. */
export async function saveCapture(surveyId: number, values: CaptureValues): Promise<void> {
  await write("altitud.survey", [surveyId], {
    description: values.description.trim(),
    floor_count: Number.isFinite(values.floorCount) ? Math.max(0, values.floorCount) : 0,
    measurements: serializeMeasures(values.measures),
    site_conditions: values.siteConditions.trim(),
  });
}

/** El empleado toma el levantamiento. Es lo que lo habilita para capturar. */
export async function assignToEmployee(surveyId: number, employeeId: number): Promise<void> {
  await write("altitud.survey", [surveyId], { employee_id: employeeId });
}

/**
 * Cierra el levantamiento: queda listo para cotizar. Firma quién levantó y
 * cuándo, con el empleado de la sesión y el día local.
 */
export async function closeSurvey(
  surveyId: number,
  employeeId: number,
  values: CaptureValues,
): Promise<void> {
  const missing = missingToClose(values);
  if (missing.length > 0) {
    throw new OdooError(`Falta ${missing.join(", ")} para cerrar el levantamiento.`, 400);
  }
  await saveCapture(surveyId, values);
  await write("altitud.survey", [surveyId], {
    state: "listo",
    survey_date: todayIso(),
    surveyed_by_id: employeeId,
  });
}

/** Reabre para corregir. Con cotización ya generada, el cambio es de oficina. */
export async function reopenSurvey(surveyId: number): Promise<void> {
  const records = await read<SurveyRecord>("altitud.survey", [surveyId], ["sale_order_id"]);
  if (records[0]?.sale_order_id) {
    throw new OdooError(
      "Este levantamiento ya tiene cotización. Para corregirlo, avisa a oficina.",
      400,
    );
  }
  await write("altitud.survey", [surveyId], { state: "abierto" });
}

export async function addPhoto(
  surveyId: number,
  file: { name: string; mimetype: string; base64: string },
): Promise<number> {
  const attachmentId = await create("ir.attachment", {
    name: file.name,
    datas: file.base64,
    mimetype: file.mimetype,
    res_model: "altitud.survey",
    res_id: surveyId,
  });
  await write("altitud.survey", [surveyId], { photo_ids: [[4, attachmentId]] });
  return attachmentId;
}

export async function removePhoto(surveyId: number, attachmentId: number): Promise<void> {
  await assertPhotoOfSurvey(surveyId, attachmentId);
  await write("altitud.survey", [surveyId], { photo_ids: [[3, attachmentId]] });
  await unlink("ir.attachment", [attachmentId]);
}

/** El adjunto se sirve por aquí; antes hay que probar que es de un levantamiento. */
export async function getPhotoBytes(
  attachmentId: number,
): Promise<{ body: Buffer; mimetype: string } | null> {
  const attachments = await read<{
    id: number;
    datas: string | false;
    mimetype: string | false;
    res_model: string | false;
  }>("ir.attachment", [attachmentId], ["id", "datas", "mimetype", "res_model"]);
  const attachment = attachments[0];
  if (!attachment || attachment.res_model !== "altitud.survey" || !attachment.datas) return null;
  return {
    body: Buffer.from(attachment.datas, "base64"),
    mimetype: text(attachment.mimetype) || "application/octet-stream",
  };
}

async function assertPhotoOfSurvey(surveyId: number, attachmentId: number): Promise<void> {
  const records = await read<SurveyRecord>("altitud.survey", [surveyId], ["photo_ids"]);
  if (!records[0]?.photo_ids?.includes(attachmentId)) {
    throw new OdooError("Esa foto no es de este levantamiento.", 404);
  }
}

/** El colaborador ligado al usuario que entró. Sin él, el portal no aplica. */
export async function findEmployeeForUser(
  uid: number,
): Promise<{ id: number; name: string } | null> {
  const employees = await searchRead<{ id: number; name: string }>(
    "hr.employee",
    [["user_id", "=", uid]],
    { fields: ["id", "name"], limit: 1 },
  );
  const employee = employees[0];
  return employee ? { id: employee.id, name: employee.name } : null;
}
