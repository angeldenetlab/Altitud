import type {
  ActualEntry,
  BudgetLine,
  Client,
  CompanyCode,
  CostCategory,
  Project,
  ProjectArea,
  ProjectEvidence,
  ProjectExtra,
  ProjectPhase,
  ProjectQuoteRef,
  ProjectRow,
  ProjectStage,
  QuoteStatus,
  QuoteSurvey,
} from "@/types/altitude";
import { computeTotals, num, round2, str } from "@/lib/compute";
import {
  type Domain,
  type Many2One,
  m2oId,
  m2oName,
  searchRead,
  setAllowedCompanies,
} from "@/lib/odoo/client";

/**
 * Lectura compartida del ERP.
 *
 * Un `ProjectRow` junta datos de seis lugares de Odoo. Todo lo de aquí lee en
 * lote (una consulta por colección, no una por proyecto) para que la lista y
 * el tablero no se vayan en N+1.
 */

// ---------------------------------------------------------------------------
// Catálogos que no cambian: se resuelven una vez por proceso
// ---------------------------------------------------------------------------

interface CompanyMaps {
  byCode: Map<CompanyCode, number>;
  byId: Map<number, CompanyCode>;
  rows: { id: number; code: CompanyCode; name: string; rfc: string }[];
}

let companyCache: Promise<CompanyMaps> | null = null;

export function resetErpCaches() {
  companyCache = null;
  stageCache = null;
}

export async function getCompanies(): Promise<CompanyMaps> {
  if (!companyCache) {
    companyCache = searchRead<{
      id: number;
      name: string;
      vat: string | false;
      x_code: CompanyCode | false;
    }>("res.company", [], { fields: ["id", "name", "vat", "x_code"], order: "id" }).then(
      (rows) => {
        const byCode = new Map<CompanyCode, number>();
        const byId = new Map<number, CompanyCode>();
        const list: CompanyMaps["rows"] = [];
        rows.forEach((row) => {
          const code = (row.x_code || "altitude") as CompanyCode;
          if (row.x_code) byCode.set(code, row.id);
          byId.set(row.id, code);
          list.push({ id: row.id, code, name: row.name, rfc: row.vat || "" });
        });
        // A partir de aquí toda llamada opera sobre estas compañías.
        setAllowedCompanies(rows.map((row) => row.id));
        return { byCode, byId, rows: list };
      },
      (error) => {
        companyCache = null;
        throw error;
      },
    );
  }
  return companyCache;
}

export async function companyIdOf(code: string | undefined): Promise<number> {
  const { byCode } = await getCompanies();
  return byCode.get((code ?? "altitude") as CompanyCode) ?? byCode.get("altitude") ?? 1;
}

export async function companyCodeOf(id: number | undefined): Promise<CompanyCode> {
  const { byId } = await getCompanies();
  return (id && byId.get(id)) || "altitude";
}

interface StageMaps {
  byCode: Map<ProjectStage, number>;
  byId: Map<number, ProjectStage>;
  rows: { id: number; code: ProjectStage; name: string; sequence: number }[];
}

let stageCache: Promise<StageMaps> | null = null;

export async function getStages(): Promise<StageMaps> {
  if (!stageCache) {
    stageCache = searchRead<{
      id: number;
      name: string;
      sequence: number;
      x_code: ProjectStage | false;
    }>("project.project.stage", [], {
      fields: ["id", "name", "sequence", "x_code"],
      order: "sequence, id",
    }).then(
      (rows) => {
        const byCode = new Map<ProjectStage, number>();
        const byId = new Map<number, ProjectStage>();
        const list: StageMaps["rows"] = [];
        rows.forEach((row) => {
          if (!row.x_code) return;
          byCode.set(row.x_code, row.id);
          byId.set(row.id, row.x_code);
          list.push({ id: row.id, code: row.x_code, name: row.name, sequence: row.sequence });
        });
        return { byCode, byId, rows: list };
      },
      (error) => {
        stageCache = null;
        throw error;
      },
    );
  }
  return stageCache;
}

export async function stageIdOf(code: string | undefined): Promise<number | undefined> {
  const { byCode } = await getStages();
  return byCode.get((code ?? "levantamiento") as ProjectStage);
}

export async function stageCodeOf(id: number | undefined): Promise<ProjectStage> {
  const { byId } = await getStages();
  return (id && byId.get(id)) || "levantamiento";
}

// ---------------------------------------------------------------------------
// Proyectos
// ---------------------------------------------------------------------------

/** Solo el trabajo de Altitud lleva folio; lo demás (p. ej. el proyecto
 *  interno de partes de horas) no es parte del directorio. [R-01] */
export const PROJECT_DOMAIN: Domain = [["x_folio", "!=", false]];

const PROJECT_FIELDS = [
  "id",
  "name",
  "x_folio",
  "partner_id",
  "x_sitio",
  "x_area",
  "company_id",
  "stage_id",
  "user_id",
  "x_coordinator_id",
  "date_start",
  "date",
  "x_quote_folio",
  "x_contract_amount",
  "x_notes",
  "x_survey_done_by",
  "x_survey_date",
  "x_survey_notes",
  "x_survey_measurements",
  "x_invoiced_amount",
  "x_invoice_refs",
  "x_closed_at",
  "x_closed_by",
  "x_closure_notes",
  "account_id",
];

interface OdooProject {
  id: number;
  name: string;
  x_folio: string | false;
  partner_id: Many2One;
  x_sitio: string | false;
  x_area: ProjectArea | false;
  company_id: Many2One;
  stage_id: Many2One;
  user_id: Many2One;
  x_coordinator_id: Many2One;
  date_start: string | false;
  date: string | false;
  x_quote_folio: string | false;
  x_contract_amount: number;
  x_notes: string | false;
  x_survey_done_by: string | false;
  x_survey_date: string | false;
  x_survey_notes: string | false;
  x_survey_measurements: string | false;
  x_invoiced_amount: number;
  x_invoice_refs: string | false;
  x_closed_at: string | false;
  x_closed_by: string | false;
  x_closure_notes: string | false;
  account_id: Many2One;
}

function groupBy<T>(rows: T[], key: (row: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>();
  rows.forEach((row) => {
    const id = key(row);
    const list = map.get(id);
    if (list) list.push(row);
    else map.set(id, [row]);
  });
  return map;
}

/**
 * Carga proyectos completos: presupuesto, gasto real, fases, extras,
 * evidencias, cierre, cotizaciones ligadas y totales.
 */
export async function loadProjects(domain: Domain = []): Promise<ProjectRow[]> {
  const projects = await searchRead<OdooProject>(
    "project.project",
    [...PROJECT_DOMAIN, ...domain],
    { fields: PROJECT_FIELDS, order: "x_folio desc" },
  );
  if (projects.length === 0) return [];
  return hydrateProjects(projects);
}

export async function loadProjectById(id: number): Promise<ProjectRow | null> {
  const projects = await searchRead<OdooProject>("project.project", [["id", "=", id]], {
    fields: PROJECT_FIELDS,
  });
  if (projects.length === 0) return null;
  const [row] = await hydrateProjects(projects);
  return row ?? null;
}

async function hydrateProjects(projects: OdooProject[]): Promise<ProjectRow[]> {
  const ids = projects.map((project) => project.id);
  const accountIds = projects.map((p) => m2oId(p.account_id)).filter((v): v is number => !!v);

  const [budgets, analytic, purchases, tasks, extras, evidence, quotes, companies, stages] =
    await Promise.all([
      searchRead<{
        id: number;
        project_id: Many2One;
        category: CostCategory;
        concept: string;
        unit: string | false;
        qty: number;
        unit_cost: number;
        amount: number;
        notes: string | false;
      }>("altitud.budget.line", [["project_id", "in", ids]], {
        fields: [
          "id",
          "project_id",
          "category",
          "concept",
          "unit",
          "qty",
          "unit_cost",
          "amount",
          "notes",
        ],
        order: "sequence, id",
      }),
      loadAnalyticActuals(ids, accountIds),
      loadPurchaseActuals(ids),
      searchRead<{
        id: number;
        project_id: Many2One;
        name: string;
        x_weight: number;
        x_progress: number;
        x_assignee_id: Many2One;
        date_deadline: string | false;
        x_done_date: string | false;
      }>("project.task", [["project_id", "in", ids], ["x_is_phase", "=", true]], {
        fields: [
          "id",
          "project_id",
          "name",
          "x_weight",
          "x_progress",
          "x_assignee_id",
          "date_deadline",
          "x_done_date",
        ],
        order: "sequence, id",
      }),
      searchRead<{
        id: number;
        project_id: Many2One;
        kind: "extra" | "faltante";
        category: CostCategory;
        concept: string;
        amount: number;
        date: string;
        billable: boolean;
        approved_by: string | false;
        quote_folio: string | false;
      }>("altitud.extra", [["project_id", "in", ids]], {
        fields: [
          "id",
          "project_id",
          "kind",
          "category",
          "concept",
          "amount",
          "date",
          "billable",
          "approved_by",
          "quote_folio",
        ],
        order: "date desc, id desc",
      }),
      searchRead<{
        id: number;
        res_id: number;
        name: string;
        description: string | false;
        create_date: string;
        create_uid: Many2One;
      }>(
        "ir.attachment",
        [
          ["res_model", "=", "project.project"],
          ["res_id", "in", ids],
        ],
        {
          fields: ["id", "res_id", "name", "description", "create_date", "create_uid"],
          order: "id desc",
        },
      ),
      searchRead<{
        id: number;
        project_id: Many2One;
        x_folio: string | false;
        x_status: QuoteStatus | false;
        amount_untaxed: number;
        date_order: string;
        x_origin: ProjectQuoteRef["origin"] | false;
      }>("sale.order", [["project_id", "in", ids]], {
        fields: ["id", "project_id", "x_folio", "x_status", "amount_untaxed", "date_order", "x_origin"],
        order: "date_order desc",
      }),
      getCompanies(),
      getStages(),
    ]);

  const budgetsBy = groupBy(budgets, (row) => m2oId(row.project_id) ?? 0);
  const tasksBy = groupBy(tasks, (row) => m2oId(row.project_id) ?? 0);
  const extrasBy = groupBy(extras, (row) => m2oId(row.project_id) ?? 0);
  const evidenceBy = groupBy(evidence, (row) => row.res_id);
  const quotesBy = groupBy(quotes, (row) => m2oId(row.project_id) ?? 0);
  const actualsBy = new Map<number, ActualEntry[]>();
  [...analytic, ...purchases].forEach((entry) => {
    const list = actualsBy.get(entry.projectId);
    if (list) list.push(entry.actual);
    else actualsBy.set(entry.projectId, [entry.actual]);
  });

  return projects.map((row) => {
    const project: Project = {
      id: row.id,
      folio: row.x_folio || "",
      name: row.name,
      client_id: m2oId(row.partner_id),
      client: m2oName(row.partner_id) ?? "Sin cliente",
      site: row.x_sitio || undefined,
      area: (row.x_area || "limpieza") as ProjectArea,
      company: companies.byId.get(m2oId(row.company_id) ?? 0) ?? "altitude",
      stage: stages.byId.get(m2oId(row.stage_id) ?? 0) ?? "levantamiento",
      supervisor: m2oName(row.user_id) ?? "Por asignar",
      coordinator: m2oName(row.x_coordinator_id) ?? undefined,
      start_date: row.date_start || row.date || "",
      end_date: row.date || undefined,
      quote_folio: row.x_quote_folio || undefined,
      contract_amount: round2(row.x_contract_amount || 0),
      budget: (budgetsBy.get(row.id) ?? []).map(
        (line): BudgetLine => ({
          id: line.id,
          category: line.category,
          concept: line.concept,
          unit: line.unit || "lote",
          qty: line.qty,
          unit_cost: round2(line.unit_cost),
          amount: round2(line.amount),
          notes: line.notes || undefined,
        }),
      ),
      actuals: (actualsBy.get(row.id) ?? []).sort((a, b) => (a.date < b.date ? 1 : -1)),
      phases: (tasksBy.get(row.id) ?? []).map(
        (task): ProjectPhase => ({
          id: task.id,
          name: task.name,
          weight: task.x_weight,
          progress: task.x_progress,
          assignee_id: m2oId(task.x_assignee_id),
          assignee: m2oName(task.x_assignee_id),
          due_date: task.date_deadline ? task.date_deadline.slice(0, 10) : undefined,
          done_date: task.x_done_date || undefined,
        }),
      ),
      extras: (extrasBy.get(row.id) ?? []).map(
        (extra): ProjectExtra => ({
          id: extra.id,
          kind: extra.kind,
          category: extra.category,
          concept: extra.concept,
          amount: round2(extra.amount),
          date: extra.date,
          billable: extra.billable,
          approved_by: extra.approved_by || undefined,
          quote_folio: extra.quote_folio || undefined,
        }),
      ),
      evidence: (evidenceBy.get(row.id) ?? [])
        .filter((item) => parseEvidenceMeta(item.description).kind !== "survey")
        .map((item): ProjectEvidence => {
          const meta = parseEvidenceMeta(item.description);
          return {
            id: item.id,
            title: item.name,
            phase: meta.phase,
            date: item.create_date.slice(0, 10),
            author: meta.author ?? m2oName(item.create_uid) ?? "Usuario",
            placeholder: meta.placeholder ?? "altura-1",
            note: meta.note,
          };
        }),
      closure: row.x_closed_at
        ? {
            closed_at: row.x_closed_at,
            closed_by: row.x_closed_by || "Usuario",
            invoiced_amount: round2(row.x_invoiced_amount || 0),
            invoice_refs: (row.x_invoice_refs || "")
              .split(",")
              .map((ref) => ref.trim())
              .filter(Boolean),
            notes: row.x_closure_notes || undefined,
          }
        : undefined,
      notes: row.x_notes || undefined,
      survey: projectSurvey(
        row,
        (evidenceBy.get(row.id) ?? []).filter(
          (item) => parseEvidenceMeta(item.description).kind === "survey",
        ),
      ),
    };

    const quoteRefs: ProjectQuoteRef[] = (quotesBy.get(row.id) ?? []).map((quote) => ({
      id: quote.id,
      folio: quote.x_folio || `SO-${quote.id}`,
      status: (quote.x_status || "calculo") as QuoteStatus,
      amount_total: round2(quote.amount_untaxed),
      date: quote.date_order.slice(0, 10),
      origin: quote.x_origin || undefined,
    }));

    return { ...project, totals: computeTotals(project), quotes: quoteRefs };
  });
}

interface BillAnalyticLine {
  id: number;
  name: string;
  date: string;
  amount: number;
  ref: string | false;
  account_id: Many2One;
  move_line_id: Many2One;
}

/**
 * Partida de cada línea analítica nacida de una factura de proveedor.
 *
 * El rastro es: línea analítica → apunte contable → línea del pedido de
 * compra → pedido, que es quien guarda `x_partida`.
 */
async function partidasOfBillLines(
  lines: BillAnalyticLine[],
): Promise<Map<number, CostCategory>> {
  const result = new Map<number, CostCategory>();
  const moveLineIds = lines.map((line) => m2oId(line.move_line_id) ?? 0).filter(Boolean);
  if (moveLineIds.length === 0) return result;

  const moveLines = await searchRead<{ id: number; purchase_line_id: Many2One }>(
    "account.move.line",
    [["id", "in", [...new Set(moveLineIds)]]],
    { fields: ["id", "purchase_line_id"] },
  );
  const purchaseLineIds = moveLines
    .map((row) => m2oId(row.purchase_line_id) ?? 0)
    .filter(Boolean);
  if (purchaseLineIds.length === 0) return result;

  const purchaseLines = await searchRead<{ id: number; order_id: Many2One }>(
    "purchase.order.line",
    [["id", "in", [...new Set(purchaseLineIds)]]],
    { fields: ["id", "order_id"] },
  );
  const orderIds = purchaseLines.map((row) => m2oId(row.order_id) ?? 0).filter(Boolean);
  if (orderIds.length === 0) return result;

  const orders = await searchRead<{ id: number; x_partida: CostCategory | false }>(
    "purchase.order",
    [["id", "in", [...new Set(orderIds)]]],
    { fields: ["id", "x_partida"] },
  );

  const partidaByOrder = new Map(orders.map((order) => [order.id, order.x_partida]));
  const orderByPurchaseLine = new Map(
    purchaseLines.map((row) => [row.id, m2oId(row.order_id) ?? 0]),
  );
  const purchaseLineByMoveLine = new Map(
    moveLines.map((row) => [row.id, m2oId(row.purchase_line_id) ?? 0]),
  );

  lines.forEach((line) => {
    const moveLineId = m2oId(line.move_line_id) ?? 0;
    const purchaseLineId = purchaseLineByMoveLine.get(moveLineId) ?? 0;
    const orderId = orderByPurchaseLine.get(purchaseLineId) ?? 0;
    const partida = partidaByOrder.get(orderId);
    if (partida) result.set(line.id, partida);
  });

  return result;
}

interface ActualWithProject {
  projectId: number;
  actual: ActualEntry;
}

/**
 * Gasto real que vive en la analítica.
 *
 * Son dos cosas: las líneas que escribe Altitud (asistencia, gasto de campo,
 * captura manual, faltante) y las que genera Odoo al contabilizar una factura
 * de proveedor. Estas últimas no llevan `x_project_id`, así que se buscan por
 * la cuenta analítica del proyecto.
 */
async function loadAnalyticActuals(
  projectIds: number[],
  accountIds: number[],
): Promise<ActualWithProject[]> {
  const fields = [
    "id",
    "name",
    "date",
    "amount",
    "ref",
    "x_project_id",
    "x_partida",
    "x_source",
    "x_registered_by",
    "account_id",
    "move_line_id",
  ];

  const [own, fromBills] = await Promise.all([
    searchRead<{
      id: number;
      name: string;
      date: string;
      amount: number;
      ref: string | false;
      x_project_id: Many2One;
      x_partida: CostCategory | false;
      x_source: ActualEntry["source"] | "faltante" | false;
      x_registered_by: string | false;
    }>("account.analytic.line", [["x_project_id", "in", projectIds]], {
      fields,
      order: "date desc, id desc",
    }),
    accountIds.length
      ? searchRead<BillAnalyticLine>(
          "account.analytic.line",
          [
            ["account_id", "in", accountIds],
            ["x_project_id", "=", false],
          ],
          { fields, order: "date desc, id desc" },
        )
      : Promise.resolve([] as BillAnalyticLine[]),
  ]);

  const accountToProject = new Map<number, number>();
  if (accountIds.length) {
    const projects = await searchRead<{ id: number; account_id: Many2One }>(
      "project.project",
      [["id", "in", projectIds]],
      { fields: ["id", "account_id"] },
    );
    projects.forEach((project) => {
      const accountId = m2oId(project.account_id);
      if (accountId) accountToProject.set(accountId, project.id);
    });
  }

  const entries: ActualWithProject[] = own.map((line) => ({
    projectId: m2oId(line.x_project_id) ?? 0,
    actual: {
      id: line.id,
      category: (line.x_partida || "materiales") as CostCategory,
      concept: line.name,
      date: line.date,
      // En la analítica el costo es negativo y el front lo muestra positivo.
      // Se invierte el signo en vez de tomar el valor absoluto: una nota de
      // crédito del proveedor llega positiva y tiene que **restar** costo, no
      // sumarlo.
      amount: round2(-line.amount),
      source: normalizeSource(line.x_source),
      reference: line.ref || undefined,
      registered_by: line.x_registered_by || undefined,
    },
  }));

  // La partida de una línea de factura no se inventa: se sigue el rastro
  // hasta el pedido de compra que la originó. Si se dejara fija en
  // «materiales», contabilizar la factura movería el costo de partida a
  // espaldas del usuario y el comparativo del proyecto cambiaría solo.
  const partidaByBillLine = await partidasOfBillLines(fromBills);

  fromBills.forEach((line) => {
    const projectId = accountToProject.get(m2oId(line.account_id) ?? 0);
    if (!projectId) return;
    entries.push({
      projectId,
      actual: {
        id: line.id,
        category: partidaByBillLine.get(line.id) ?? "materiales",
        concept: line.name,
        date: line.date,
        amount: round2(-line.amount),
        source: "compra",
        reference: line.ref || undefined,
      },
    });
  });

  return entries;
}

/** Un faltante es costo capturado a mano; el front solo conoce 4 orígenes. */
function normalizeSource(source: string | false): ActualEntry["source"] {
  if (source === "compra" || source === "asistencia" || source === "gasto_campo") return source;
  return "manual";
}

/**
 * La compra pega en el costo en cuanto se registra. [R-24]
 *
 * Odoo solo escribe en la analítica al contabilizar la factura del proveedor,
 * que aquí vive en CONTPAQi y probablemente nunca llegue. Por eso el costo de
 * compras es lo confirmado que todavía no se factura, igual que el reporte
 * nativo de rentabilidad: así no se duplica si algún día sí se contabiliza.
 */
async function loadPurchaseActuals(projectIds: number[]): Promise<ActualWithProject[]> {
  const orders = await searchRead<{
    id: number;
    x_folio: string | false;
    name: string;
    x_project_id: Many2One;
    x_partida: CostCategory | false;
    x_concept: string | false;
    x_requested_by: string | false;
    date_order: string;
    order_line: number[];
  }>(
    "purchase.order",
    [
      ["x_project_id", "in", projectIds],
      ["state", "in", ["purchase", "done"]],
    ],
    {
      fields: [
        "id",
        "x_folio",
        "name",
        "x_project_id",
        "x_partida",
        "x_concept",
        "x_requested_by",
        "date_order",
        "order_line",
      ],
      order: "date_order desc",
    },
  );
  if (orders.length === 0) return [];

  const lineIds = orders.flatMap((order) => order.order_line);
  const lines = lineIds.length
    ? await searchRead<{
        id: number;
        order_id: Many2One;
        price_unit: number;
        qty_to_invoice: number;
      }>("purchase.order.line", [["id", "in", lineIds]], {
        fields: ["id", "order_id", "price_unit", "qty_to_invoice"],
      })
    : [];

  const pendingByOrder = new Map<number, number>();
  lines.forEach((line) => {
    const orderId = m2oId(line.order_id) ?? 0;
    const current = pendingByOrder.get(orderId) ?? 0;
    pendingByOrder.set(orderId, current + line.qty_to_invoice * line.price_unit);
  });

  return orders
    .map((order) => ({
      projectId: m2oId(order.x_project_id) ?? 0,
      amount: round2(pendingByOrder.get(order.id) ?? 0),
      order,
    }))
    .filter((row) => row.amount > 0)
    .map(({ projectId, amount, order }) => ({
      projectId,
      actual: {
        // Id negativo: no es una línea analítica, es el pedido de compra.
        id: -order.id,
        category: (order.x_partida || "materiales") as CostCategory,
        concept: order.x_concept || order.name,
        date: order.date_order.slice(0, 10),
        amount,
        source: "compra" as const,
        reference: order.x_folio || order.name,
        registered_by: order.x_requested_by || undefined,
      },
    }));
}

// ---------------------------------------------------------------------------
// Evidencias: los metadatos viajan en la descripción del adjunto
// ---------------------------------------------------------------------------

interface EvidenceMeta {
  phase?: string;
  author?: string;
  placeholder?: string;
  note?: string;
  kind?: "survey" | "execution";
}

export function parseMeasurements(
  raw: string | false | undefined,
): { label: string; value: number; unit: string }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { label: string; value: number; unit: string }[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function projectSurvey(
  row: OdooProject,
  photos: { id: number; name: string; description: string | false }[],
): QuoteSurvey | undefined {
  const measurements = parseMeasurements(row.x_survey_measurements);
  if (!row.x_survey_done_by && measurements.length === 0 && photos.length === 0 && !row.x_survey_notes) {
    return undefined;
  }
  return {
    done_by: row.x_survey_done_by || "Sin responsable",
    date: row.x_survey_date || row.date_start || "",
    measurements,
    photos: photos.map((photo) => {
      const meta = parseEvidenceMeta(photo.description);
      return {
        id: photo.id,
        title: photo.name,
        placeholder: meta.placeholder ?? "altura-1",
      };
    }),
    notes: row.x_survey_notes || undefined,
  };
}

export function serializeEvidenceMeta(meta: EvidenceMeta): string {
  return JSON.stringify(meta);
}

function parseEvidenceMeta(description: string | false): EvidenceMeta {
  if (!description) return {};
  try {
    const parsed = JSON.parse(description) as EvidenceMeta;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return { note: description };
  }
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export const CLIENT_DOMAIN: Domain = [["customer_rank", ">", 0]];

export const CLIENT_FIELDS = [
  "id",
  "x_folio",
  "name",
  "email",
  "phone",
  "mobile",
  "vat",
  "company_id",
  "comment",
  "active",
  "child_ids",
];

export interface OdooPartner {
  id: number;
  x_folio: string | false;
  name: string;
  email: string | false;
  phone: string | false;
  mobile: string | false;
  vat: string | false;
  company_id: Many2One;
  comment: string | false;
  active: boolean;
  child_ids: number[];
}

/**
 * El contacto del cliente es un `res.partner` hijo, que es donde Odoo lo
 * guarda. `toClientMany` lo resuelve en lote; esta versión de una sola ficha
 * lo deja vacío para no disparar una consulta por renglón.
 */
export async function toClient(row: OdooPartner, contact?: string): Promise<Client> {
  return {
    id: row.id,
    folio: row.x_folio || `CLI-${row.id}`,
    name: row.name,
    contact,
    email: row.email || undefined,
    phone: row.phone || row.mobile || undefined,
    rfc: row.vat || undefined,
    company: await companyCodeOf(m2oId(row.company_id)),
    notes: stripHtml(row.comment),
    active: row.active,
  };
}

/** Mapea varios partners resolviendo sus contactos en una sola consulta. */
export async function toClientMany(rows: OdooPartner[]): Promise<Client[]> {
  const childIds = rows.flatMap((row) => row.child_ids);
  const children = childIds.length
    ? await searchRead<{ id: number; name: string; parent_id: Many2One }>(
        "res.partner",
        [["id", "in", childIds]],
        { fields: ["id", "name", "parent_id"], context: { active_test: false } },
      )
    : [];

  const contactByParent = new Map<number, string>();
  children.forEach((child) => {
    const parentId = m2oId(child.parent_id) ?? 0;
    if (!contactByParent.has(parentId)) contactByParent.set(parentId, child.name);
  });

  return Promise.all(rows.map((row) => toClient(row, contactByParent.get(row.id))));
}

export function stripHtml(value: string | false): string | undefined {
  if (!value) return undefined;
  const text = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
  return text || undefined;
}

/** Resuelve el cliente que viene en el payload (id del catálogo o nombre). */
export async function resolveClient(
  payload: Record<string, unknown>,
): Promise<{ id: number; name: string } | { error: string }> {
  const clientId = num(payload.client_id, 0);
  if (clientId > 0) {
    const rows = await searchRead<{ id: number; name: string; active: boolean }>(
      "res.partner",
      [["id", "=", clientId]],
      { fields: ["id", "name", "active"] },
    );
    if (rows.length === 0) return { error: "El cliente seleccionado no existe." };
    if (!rows[0].active) return { error: "El cliente seleccionado está inactivo." };
    return { id: rows[0].id, name: rows[0].name };
  }

  const name = str(payload.client);
  if (!name) return { error: "Selecciona un cliente del catálogo." };

  const matches = await searchRead<{ id: number; name: string }>(
    "res.partner",
    [...CLIENT_DOMAIN, ["name", "=ilike", name]],
    { fields: ["id", "name"], limit: 1 },
  );
  if (matches.length > 0) return { id: matches[0].id, name: matches[0].name };
  return { error: `El cliente "${name}" no está en el catálogo.` };
}
