/**
 * Contratos del dominio Altitude.
 *
 * Cada tipo lleva, entre corchetes, el requerimiento que lo origina (R-xx) y,
 * cuando aplica, el modelo de Odoo con el que se piensa empatar en la fase de
 * integración. Ver `docs/INTEGRACION-ODOO.md` para el mapeo completo.
 */

// ---------------------------------------------------------------------------
// Catálogos base
// ---------------------------------------------------------------------------

/** Áreas operativas de la empresa. [R-02] */
export type ProjectArea = "altura" | "limpieza" | "obra";

/** Razones sociales con las que se opera. [R-37] → `res.company` */
export type CompanyCode = "altitude" | "servicios";

/**
 * Partidas con las que se costea. La estructura es idéntica en las tres áreas,
 * por eso un solo módulo sirve para todas. [R-03] [R-08]
 * → `account.analytic.line` agrupada por categoría / `product.category`
 */
export type CostCategory =
  | "mano_obra"
  | "materiales"
  | "herramienta"
  | "gastos_operativos"
  | "indirectos";

/**
 * Etapas del proyecto. Es la columna del kanban y lo que se delega.
 * → `project.project.stage_id` (project.project.stage)
 */
export type ProjectStage =
  | "levantamiento"
  | "cotizado"
  | "autorizado"
  | "ejecucion"
  | "por_cerrar"
  | "cerrado"
  | "perdido";

/** Estatus del flujo de autorización de una cotización. [R-13] [R-15] */
export type QuoteStatus =
  | "levantamiento"
  | "calculo"
  | "vobo_socio"
  | "enviada"
  | "autorizada"
  | "no_autorizada";

/** Origen de la captura de asistencia. [R-17] [R-18] */
export type AttendanceSource = "portal" | "supervisor" | "web" | "telegram";

/** Tipo de jornada registrada. [R-20] */
export type AttendanceKind = "completa" | "media" | "falta";

// ---------------------------------------------------------------------------
// Proyectos [R-01 … R-08]
// ---------------------------------------------------------------------------

/** Renglón del presupuesto base, desglosado por partida. [R-03] */
export interface BudgetLine {
  id: number;
  category: CostCategory;
  concept: string;
  /** jornal, pieza, m², servicio, lote… */
  unit: string;
  qty: number;
  unit_cost: number;
  amount: number;
  notes?: string;
}

/** Gasto real cargado al proyecto, partida por partida. [R-04] */
export interface ActualEntry {
  id: number;
  category: CostCategory;
  concept: string;
  date: string;
  amount: number;
  /** De dónde salió el gasto: alimenta la trazabilidad sin doble captura. [R-24] */
  source: "compra" | "asistencia" | "gasto_campo" | "manual";
  /** Folio de la compra, del día de asistencia o del gasto de campo. */
  reference?: string;
  registered_by?: string;
}

/** Fase del proyecto con su avance y responsable. [R-05] [R-28] */
export interface ProjectPhase {
  id: number;
  name: string;
  /** Peso de la fase sobre el avance total (suma 100). */
  weight: number;
  /** 0–100 */
  progress: number;
  /** Colaborador del padrón (`hr.employee`). No depende de la cuadrilla. */
  assignee_id?: number;
  assignee?: string;
  due_date?: string;
  done_date?: string;
}

/** Lo que se ocupó de más o lo que no se contempló. [R-06] */
export interface ProjectExtra {
  id: number;
  kind: "extra" | "faltante";
  category: CostCategory;
  concept: string;
  amount: number;
  date: string;
  /** Si es extra cobrable al cliente. */
  billable: boolean;
  approved_by?: string;
  /** Folio de la cotización con la que se le cobró al cliente. [R-06] [R-09] */
  quote_folio?: string;
}

/** Evidencia fotográfica del sitio. [R-26] */
export interface ProjectEvidence {
  id: number;
  title: string;
  phase?: string;
  date: string;
  author: string;
  /** En la demo es un color/etiqueta; con el ERP será el adjunto real. */
  placeholder: string;
  note?: string;
}

/** Cierre del proyecto: presupuestado vs real vs facturado. [R-07] */
export interface ProjectClosure {
  closed_at: string;
  closed_by: string;
  /** Facturado en CONTPAQi; el folio se captura a mano por ahora. [R-35] */
  invoiced_amount: number;
  invoice_refs: string[];
  notes?: string;
}

export interface Project {
  id: number;
  /** Folio para todo trabajo, sin importar su tamaño. [R-01] */
  folio: string;
  name: string;
  /** Cliente del catálogo. → `res.partner` */
  client_id?: number;
  client: string;
  client_contact?: string;
  site?: string;
  area: ProjectArea;
  company: CompanyCode;
  stage: ProjectStage;
  supervisor: string;
  /** Responsable de control de proyectos. */
  coordinator?: string;
  start_date: string;
  end_date?: string;
  /** Cotización que originó el proyecto. */
  quote_folio?: string;
  /** Precio de venta autorizado al cliente. */
  contract_amount: number;
  budget: BudgetLine[];
  actuals: ActualEntry[];
  phases: ProjectPhase[];
  extras: ProjectExtra[];
  evidence: ProjectEvidence[];
  closure?: ProjectClosure;
  notes?: string;
  /** Levantamiento de campo: el lead, antes de la cotización. */
  survey?: QuoteSurvey;
}

/**
 * Totales derivados que consume la UI (los calcula el BFF).
 *
 * La comparación honesta a media obra es contra el presupuesto **devengado**
 * (lo que debería haberse gastado al avance actual), no contra el presupuesto
 * completo: así se detecta el sobrecosto cuando todavía se puede corregir.
 */
export interface ProjectTotals {
  budget_total: number;
  actual_total: number;
  /** Presupuesto que corresponde al avance actual (budget × avance). */
  earned_budget: number;
  /** Costo estimado al cierre = real + lo que falta del presupuesto. */
  forecast_cost: number;
  /** contract_amount + extras cobrables */
  billable_total: number;
  invoiced_total: number;
  /** Real − devengado: positivo = sobrecosto a la fecha. */
  variance: number;
  /** Utilidad proyectada = cobrable − costo estimado al cierre. */
  margin_amount: number;
  /** Margen % sobre lo cobrable */
  margin_pct: number;
  progress: number;
  by_category: {
    category: CostCategory;
    budget: number;
    actual: number;
    /** Presupuesto devengado de la partida. */
    earned: number;
    variance: number;
  }[];
}

/** Cotización ligada al proyecto, para verla desde su ficha. */
export interface ProjectQuoteRef {
  id: number;
  folio: string;
  status: QuoteStatus;
  amount_total: number;
  date: string;
  origin?: QuoteOrigin;
}

/** Fila de la lista / tarjeta del kanban. */
export interface ProjectRow extends Project {
  totals: ProjectTotals;
  /** Cotizaciones del cliente ligadas a este proyecto. [R-09] [R-15] */
  quotes: ProjectQuoteRef[];
}

export interface ProjectListParams {
  search?: string;
  area?: ProjectArea | "todas";
  stage?: ProjectStage | "todas";
  company?: CompanyCode | "todas";
  /** Solo proyectos con gasto real por encima del presupuesto. */
  only_overrun?: boolean;
}

// ---------------------------------------------------------------------------
// Cotizaciones y presupuestos [R-09 … R-16]
// ---------------------------------------------------------------------------

/** Servicio del catálogo, con su precio paramétrico. [R-10] [R-16] */
export interface ServiceItem {
  id: number;
  code: string;
  name: string;
  area: ProjectArea;
  /** m², pieza, jornal, servicio */
  unit: string;
  /** Precio estándar por unidad (paramétrico). [R-10] */
  price_unit: number;
  /** Costo directo estimado por unidad. */
  cost_unit: number;
  /** Rendimiento: unidades que hace un técnico en un jornal. [R-12] */
  yield_per_jornal: number;
  active: boolean;
}

export interface QuoteLine {
  id: number;
  service_id: number;
  service_name: string;
  unit: string;
  qty: number;
  price_unit: number;
  cost_unit: number;
  amount: number;
  /** Jornales calculados = qty / rendimiento. [R-12] */
  jornales: number;
}

/** Levantamiento en sitio; lo puede hacer cualquiera, no solo los socios. [R-11] */
export interface QuoteSurvey {
  done_by: string;
  date: string;
  measurements: { label: string; value: number; unit: string }[];
  photos: { id: number; title: string; placeholder: string }[];
  notes?: string;
}

/** Paso del flujo de autorización interna. [R-13] */
export interface QuoteApproval {
  step: QuoteStatus;
  user: string;
  date: string;
  comment?: string;
}

/**
 * De dónde nació la cotización.
 *  - `levantamiento`: se armó al analizar el levantamiento de campo
 *  - `extras`: extras cobrables de una obra en marcha [R-06]
 *  - `adicional`: trabajo nuevo en el mismo sitio
 *  - `inicial`: atajo viejo (proyecto abierto sin cotización)
 */
export type QuoteOrigin = "levantamiento" | "extras" | "adicional" | "inicial";

export interface Quote {
  id: number;
  /** Folio para seguimiento. [R-15] */
  folio: string;
  name: string;
  /** Cliente del catálogo. → `res.partner` */
  client_id?: number;
  client: string;
  company: CompanyCode;
  area: ProjectArea;
  status: QuoteStatus;
  date: string;
  valid_until: string;
  owner: string;
  survey?: QuoteSurvey;
  lines: QuoteLine[];
  /** % sobre costo directo con el que se cotiza. */
  overhead_pct: number;
  amount_total: number;
  cost_total: number;
  jornales_total: number;
  approvals: QuoteApproval[];
  /** Proyecto ligado: el que se generó al autorizar, o el que la originó. */
  project_folio?: string;
  project_id?: number;
  /** Presente cuando la cotización se generó desde un proyecto en marcha. */
  origin?: QuoteOrigin;
  notes?: string;
}

export interface QuoteListParams {
  search?: string;
  status?: QuoteStatus | "todas";
  area?: ProjectArea | "todas";
}

// ---------------------------------------------------------------------------
// Clientes → `res.partner` (customer)
// ---------------------------------------------------------------------------

/** Cliente / prospecto con folio propio. */
export interface Client {
  id: number;
  folio: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  rfc?: string;
  company: CompanyCode;
  notes?: string;
  active: boolean;
}

export interface ClientListParams {
  search?: string;
  company?: CompanyCode | "todas";
  active?: boolean | "todos";
}

export interface ClientStats {
  projects_count: number;
  quotes_count: number;
  orders_count: number;
  active_projects: number;
}

export interface ClientDetail extends Client {
  stats: ClientStats;
  projects: Pick<Project, "id" | "folio" | "name" | "stage" | "area" | "contract_amount">[];
  quotes: Pick<Quote, "id" | "folio" | "name" | "status" | "amount_total" | "date">[];
  orders: Pick<Quote, "id" | "folio" | "name" | "amount_total" | "date" | "project_folio">[];
}

// ---------------------------------------------------------------------------
// Personal, asistencias y prenómina [R-17 … R-22] [R-36]
// ---------------------------------------------------------------------------

/** Colaborador operativo. → `hr.employee` */
export interface Employee {
  id: number;
  name: string;
  job: string;
  area: ProjectArea | "mixto";
  /** Costo de un jornal completo. [R-20] */
  jornal: number;
  phone?: string;
  company: CompanyCode;
  active: boolean;
}

/** Asistencia del día, siempre ligada a un proyecto. [R-19] → `hr.attendance` */
export interface Attendance {
  id: number;
  date: string;
  employee_id: number;
  employee_name: string;
  project_id: number;
  project_folio: string;
  kind: AttendanceKind;
  source: AttendanceSource;
  /** Costo calculado automáticamente: jornal × factor. [R-20] */
  cost: number;
  check_in?: string;
  registered_by?: string;
  note?: string;
}

export interface AttendanceListParams {
  date?: string;
  project_id?: number;
  area?: ProjectArea | "todas";
  search?: string;
}

/** Quién de la plantilla presta servicio en un proyecto. [R-19] */
export interface CrewMember {
  id: number;
  employee_id: number;
  employee_name: string;
  job: string;
  area: ProjectArea | "mixto";
  jornal: number;
  active: boolean;
  date_from?: string;
}

/** Distribución del personal del día, por área y proyecto. [R-21] */
export interface AttendanceBoard {
  date: string;
  total_employees: number;
  present: number;
  absent: number;
  unassigned: Employee[];
  cost_day: number;
  by_area: { area: ProjectArea; present: number; cost: number }[];
  by_project: {
    project_id: number;
    folio: string;
    name: string;
    area: ProjectArea;
    present: number;
    cost: number;
    people: { attendance_id: number; employee_id: number; name: string; kind: AttendanceKind; source: AttendanceSource }[];
    /** En la cuadrilla y todavía sin registro del día. */
    pending?: { employee_id: number; name: string }[];
  }[];
}

/** Prenómina para el despacho contable; el timbrado queda fuera. [R-36] */
export interface PayrollRow {
  employee_id: number;
  employee_name: string;
  job: string;
  company: CompanyCode;
  jornal: number;
  jornales: number;
  faltas: number;
  amount: number;
  projects: string[];
}

export interface PayrollPeriod {
  from: string;
  to: string;
  rows: PayrollRow[];
  total: number;
  total_jornales: number;
}

// ---------------------------------------------------------------------------
// Compras, materiales y gastos de campo [R-23 … R-27]
// ---------------------------------------------------------------------------

/** Compra cargada directo al proyecto. [R-23] → `purchase.order` / `account.move` */
export interface Purchase {
  id: number;
  folio: string;
  date: string;
  supplier: string;
  project_id: number;
  project_folio: string;
  category: CostCategory;
  concept: string;
  amount: number;
  company: CompanyCode;
  /** Factura del proveedor; el XML se sigue conciliando en CONTPAQi. [R-35] */
  invoice_folio?: string;
  invoice_uuid?: string;
  status: "por_pagar" | "pagada" | "sin_factura";
  requested_by: string;
}

export interface PurchaseListParams {
  search?: string;
  project_id?: number;
  status?: string;
  category?: CostCategory | "todas";
}

/** Conteo básico de insumos, solo para saber cuándo reponer. [R-25] */
export interface Supply {
  id: number;
  code: string;
  name: string;
  unit: string;
  on_hand: number;
  reorder_point: number;
  last_count: string;
}

/** Gasto capturado desde el sitio. [R-27] */
export interface FieldExpense {
  id: number;
  date: string;
  project_id: number;
  project_folio: string;
  category: CostCategory;
  concept: string;
  amount: number;
  captured_by: string;
  has_receipt: boolean;
}

// ---------------------------------------------------------------------------
// Tablero y reportes [R-29 … R-32]
// ---------------------------------------------------------------------------

export interface DashboardKpis {
  active_projects: number;
  contracted_amount: number;
  actual_cost: number;
  /** Costo estimado al cierre de los proyectos activos. */
  forecast_cost: number;
  margin_pct: number;
  overrun_projects: number;
  quotes_pending: number;
  jornales_week: number;
  labor_cost_week: number;
}

export interface DashboardData {
  kpis: DashboardKpis;
  /** Proyectos activos con su avance y margen. [R-29] */
  board: ProjectRow[];
  /** Presupuestado vs real por área. [R-31] */
  by_area: { area: ProjectArea; label: string; budget: number; actual: number; margin_pct: number }[];
  alerts: { project_id: number; folio: string; name: string; message: string; severity: "alta" | "media" }[];
}

export interface ReportsData {
  /** Rentabilidad por proyecto. [R-30] */
  profitability: {
    project_id: number;
    folio: string;
    name: string;
    area: ProjectArea;
    billable: number;
    actual: number;
    margin_amount: number;
    margin_pct: number;
  }[];
  /** Rentabilidad comparada por tipo de servicio. [R-31] */
  by_area: { area: ProjectArea; label: string; projects: number; billable: number; actual: number; margin_pct: number }[];
  /** Peso de cada partida en el gasto real. */
  by_category: { category: CostCategory; label: string; amount: number }[];
  monthly: { month: string; facturado: number; costo: number }[];
}

// ---------------------------------------------------------------------------
// Bitácora del registro (chatter) — es lo que permite delegar etapas
// ---------------------------------------------------------------------------

export interface ChatterMessage {
  id: number;
  body: string;
  date: string;
  author: string;
  is_note: boolean;
  tracking: { field: string; old_value: string; new_value: string }[];
}

export interface ChatterActivity {
  id: number;
  summary: string;
  note?: string;
  date_deadline: string;
  /** overdue | today | planned */
  state: string;
  activity_type: string;
  user_name: string;
  res_model: string;
  res_id: number;
  res_name?: string;
}

export interface NotificationsResult {
  activities: ChatterActivity[];
  overdue: number;
  today: number;
  planned: number;
  total: number;
}
