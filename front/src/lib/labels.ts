import type {
  AttendanceKind,
  AttendanceSource,
  CompanyCode,
  CostCategory,
  ProjectArea,
  ProjectStage,
  QuoteStatus,
} from "@/types/altitude";

/** Áreas operativas. [R-02] */
export const AREA_LABELS: Record<ProjectArea, string> = {
  altura: "Trabajos de altura",
  limpieza: "Limpieza fina",
  obra: "Obra y acabados",
};

export const AREA_SHORT: Record<ProjectArea, string> = {
  altura: "Altura",
  limpieza: "Limpieza",
  obra: "Obra",
};

/** Partidas de costeo, en el orden en el que se presupuesta. [R-03] */
export const CATEGORY_ORDER: CostCategory[] = [
  "mano_obra",
  "materiales",
  "herramienta",
  "gastos_operativos",
  "indirectos",
];

export const CATEGORY_LABELS: Record<CostCategory, string> = {
  mano_obra: "Mano de obra",
  materiales: "Materiales",
  herramienta: "Herramienta y equipo",
  gastos_operativos: "Gastos operativos",
  indirectos: "Indirectos",
};

/** Razones sociales. [R-37] */
export const COMPANY_LABELS: Record<CompanyCode, string> = {
  altitude: "Altitude Servicios SA de CV",
  servicios: "Grupo Operativo ALT SA de CV",
};

export const COMPANY_SHORT: Record<CompanyCode, string> = {
  altitude: "Altitude",
  servicios: "Grupo ALT",
};

export const STAGE_ORDER: ProjectStage[] = [
  "levantamiento",
  "cotizado",
  "autorizado",
  "ejecucion",
  "por_cerrar",
  "cerrado",
];

export const STAGE_LABELS: Record<ProjectStage, string> = {
  levantamiento: "Levantamiento",
  cotizado: "Cotizado",
  autorizado: "Autorizado",
  ejecucion: "En ejecución",
  por_cerrar: "Por cerrar",
  cerrado: "Cerrado",
  perdido: "Perdido",
};

export const QUOTE_STATUS_ORDER: QuoteStatus[] = [
  "levantamiento",
  "calculo",
  "vobo_socio",
  "enviada",
  "autorizada",
  "no_autorizada",
];

/** Flujo de autorización interna. [R-13] */
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  levantamiento: "Levantamiento",
  calculo: "En cálculo",
  vobo_socio: "Visto bueno del socio",
  enviada: "Enviada al cliente",
  autorizada: "Autorizada",
  no_autorizada: "No autorizada",
};

export const ATTENDANCE_KIND_LABELS: Record<AttendanceKind, string> = {
  completa: "Jornada completa",
  media: "Media jornada",
  falta: "Falta",
};

/** Factor del jornal por tipo de jornada. [R-20] */
export const ATTENDANCE_FACTOR: Record<AttendanceKind, number> = {
  completa: 1,
  media: 0.5,
  falta: 0,
};

export const ATTENDANCE_SOURCE_LABELS: Record<AttendanceSource, string> = {
  portal: "Portal de campo",
  supervisor: "Supervisor",
  web: "Captura web",
  telegram: "Telegram",
};
