/** Catálogos y formas del levantamiento. Mismas claves que `altitud_base`. */

export type SurveyState = "abierto" | "listo";

export type Area = "altura" | "limpieza" | "obra";

export const AREA_LABEL: Record<Area, string> = {
  altura: "Trabajos de altura",
  limpieza: "Limpieza fina",
  obra: "Obra y acabados",
};

/** Una medida del sitio. Se guarda en `measurements` como JSON. */
export interface Measure {
  label: string;
  value: string;
  unit: string;
}

export interface Photo {
  id: number;
  name: string;
  mimetype: string;
  size: number;
}

/** Lo que pinta la lista. */
export interface SurveyRow {
  id: number;
  folio: string;
  name: string;
  sitio: string;
  state: SurveyState;
  employeeId: number | null;
  employeeName: string;
  partnerName: string;
  area: Area | null;
  companyName: string;
  surveyDate: string | null;
  mine: boolean;
}

/** La ficha completa. */
export interface Survey extends SurveyRow {
  description: string;
  floorCount: number;
  measures: Measure[];
  siteConditions: string;
  surveyedByName: string;
  photos: Photo[];
  quoteName: string;
}

/** Lo que el empleado captura en el portal. Lo demás es de oficina. */
export interface CaptureValues {
  description: string;
  floorCount: number;
  measures: Measure[];
  siteConditions: string;
}

/** Faltantes para cerrar. Vacío = se puede cerrar. */
export function missingToClose(values: CaptureValues): string[] {
  const missing: string[] = [];
  if (!values.description.trim()) missing.push("la descripción");
  if (!Number.isFinite(values.floorCount) || values.floorCount <= 0) {
    missing.push("el número de plantas");
  }
  if (!values.measures.some((measure) => measure.label.trim() && measure.value.trim())) {
    missing.push("al menos una medida");
  }
  if (!values.siteConditions.trim()) missing.push("las condiciones del sitio");
  return missing;
}

/** El campo `measurements` es texto libre heredado; puede no ser JSON. */
export function parseMeasures(raw: string | false | null | undefined): Measure[] {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("no es una lista");
    return parsed.map((item) => ({
      label: String(item?.label ?? ""),
      value: String(item?.value ?? ""),
      unit: String(item?.unit ?? ""),
    }));
  } catch {
    // Texto viejo que no era JSON: no se tira, se enseña como una medida.
    return [{ label: text, value: "", unit: "" }];
  }
}

export function serializeMeasures(measures: Measure[]): string {
  const clean = measures
    .map((measure) => ({
      label: measure.label.trim(),
      value: measure.value.trim(),
      unit: measure.unit.trim(),
    }))
    .filter((measure) => measure.label || measure.value);
  return clean.length ? JSON.stringify(clean) : "";
}
