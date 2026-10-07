import type {
  CostCategory,
  ProjectArea,
  ProjectStage,
} from "@/types/altitude";
import { CATEGORY_LABELS, CATEGORY_ORDER, STAGE_LABELS } from "@/lib/labels";
import {
  computeProgress,
  contains,
  dayIso,
  isActiveStage,
  num,
  round2,
  search,
  str,
  sum,
} from "@/lib/compute";
import { badRequest, json, notFound, type Payload, unknownAction } from "@/lib/http";
import type { SessionPayload } from "@/lib/auth/server-session";
import {
  type Many2One,
  callKw,
  create,
  createMany,
  m2oId,
  searchRead,
  unlink,
  write,
} from "@/lib/odoo/client";
import {
  companyIdOf,
  getCompanies,
  getStages,
  loadProjectById,
  loadProjects,
  resolveClient,
  serializeEvidenceMeta,
  stageIdOf,
} from "@/server/erp/common";
import { postNote } from "@/server/erp/chatter";

/**
 * Proyectos: un solo módulo para las tres áreas. [R-08]
 *
 * El proyecto es `project.project` con su cuenta analítica. Todo lo que
 * cuesta cuelga de ahí: la mano de obra como parte de horas de la asistencia,
 * las compras como pedido al proveedor, y los gastos de campo, faltantes y
 * capturas manuales como línea analítica directa.
 */

// ---------------------------------------------------------------------------
// Semillas de alta
// ---------------------------------------------------------------------------

/**
 * Las partidas son una selección en Odoo: un valor que no esté en la lista
 * truena como `ValueError`, que no es un error de usuario y se iría como 500.
 * Se valida antes de tocar nada.
 */
function validCategory(value: unknown, fallback: CostCategory = "materiales"): CostCategory | null {
  const raw = str(value);
  if (!raw) return fallback;
  return (CATEGORY_ORDER as string[]).includes(raw) ? (raw as CostCategory) : null;
}

/** Presupuesto derivado del costeo de la cotización. [R-03] */
export function budgetSeedFromCost(
  area: ProjectArea,
  cost: number,
): { category: CostCategory; concept: string; unit: string; qty: number; unit_cost: number }[] {
  const shares: { category: CostCategory; share: number; unit: string; unitCost: number }[] = [
    {
      category: "mano_obra",
      share: 0.45,
      unit: "jornal",
      unitCost: area === "limpieza" ? 470 : area === "obra" ? 590 : 700,
    },
    { category: "materiales", share: 0.25, unit: "lote", unitCost: 5200 },
    { category: "herramienta", share: 0.08, unit: "día", unitCost: 1400 },
    { category: "gastos_operativos", share: 0.12, unit: "servicio", unitCost: 1200 },
    { category: "indirectos", share: 0.1, unit: "servicio", unitCost: 4200 },
  ];

  return shares.map((row) => {
    const amount = cost * row.share;
    const qty = Math.max(1, Math.round(amount / row.unitCost));
    return {
      category: row.category,
      concept: CATEGORY_LABELS[row.category],
      unit: row.unit,
      qty,
      unit_cost: row.unitCost,
    };
  });
}

const DEFAULT_PHASES: Record<ProjectArea, { name: string; weight: number }[]> = {
  altura: [
    { name: "Montaje, permisos y seguridad", weight: 20 },
    { name: "Ejecución en fachada", weight: 50 },
    { name: "Limpieza y desmontaje", weight: 20 },
    { name: "Entrega y firma de conformidad", weight: 10 },
  ],
  limpieza: [
    { name: "Movilización y accesos", weight: 15 },
    { name: "Limpieza gruesa", weight: 35 },
    { name: "Limpieza fina y detalle", weight: 35 },
    { name: "Recorrido y entrega", weight: 15 },
  ],
  obra: [
    { name: "Preliminares y trazo", weight: 15 },
    { name: "Albañilería e instalaciones", weight: 40 },
    { name: "Acabados", weight: 30 },
    { name: "Detalles y entrega", weight: 15 },
  ],
};

export interface CreateProjectInput {
  name: string;
  clientId: number;
  site?: string;
  area: ProjectArea;
  company: string;
  supervisorId?: number;
  coordinatorId?: number;
  startDate?: string;
  endDate?: string;
  contractAmount: number;
  quoteFolio?: string;
  stage?: ProjectStage;
  notes?: string;
  surveyDoneBy?: string;
  surveyDate?: string;
  surveyNotes?: string;
  surveyMeasurements?: string;
  budget?: { category: CostCategory; concept: string; unit: string; qty: number; unit_cost: number }[];
}

/** Alta del proyecto con folio, fases y presupuesto base. [R-01] [R-03] [R-05] */
export async function createProjectRecord(input: CreateProjectInput): Promise<number> {
  const [companyId, stageId] = await Promise.all([
    companyIdOf(input.company),
    stageIdOf(input.stage ?? "levantamiento"),
  ]);

  const projectId = await create("project.project", {
    name: input.name,
    partner_id: input.clientId,
    x_sitio: input.site ?? false,
    x_area: input.area,
    company_id: companyId,
    stage_id: stageId ?? false,
    user_id: input.supervisorId ?? false,
    x_coordinator_id: input.coordinatorId ?? false,
    date_start: input.startDate ?? dayIso(0),
    date: input.endDate ?? false,
    x_quote_folio: input.quoteFolio ?? false,
    x_contract_amount: input.contractAmount,
    x_notes: input.notes ?? false,
    x_survey_done_by: input.surveyDoneBy ?? false,
    x_survey_date: input.surveyDate ?? false,
    x_survey_notes: input.surveyNotes ?? false,
    x_survey_measurements: input.surveyMeasurements ?? false,
    allow_timesheets: true,
  });

  const budget =
    input.budget ??
    (input.contractAmount > 0
      ? budgetSeedFromCost(input.area, input.contractAmount * 0.7)
      : []);
  if (budget.length > 0) {
    await createMany(
      "altitud.budget.line",
      budget.map((line, index) => ({
        project_id: projectId,
        sequence: (index + 1) * 10,
        category: line.category,
        concept: line.concept,
        unit: line.unit,
        qty: line.qty,
        unit_cost: line.unit_cost,
      })),
    );
  }

  await createMany(
    "project.task",
    DEFAULT_PHASES[input.area].map((phase, index) => ({
      name: phase.name,
      project_id: projectId,
      sequence: (index + 1) * 10,
      x_is_phase: true,
      x_weight: phase.weight,
      x_progress: 0,
      company_id: companyId,
    })),
  );

  return projectId;
}

// ---------------------------------------------------------------------------
// Gasto real que no viene de compras ni de asistencias
// ---------------------------------------------------------------------------

/**
 * Línea analítica directa sobre la cuenta del proyecto.
 *
 * No lleva `project_id`: `hr_timesheet` trata cualquier línea con proyecto
 * como parte de horas y le exige empleado. El vínculo con el proyecto viaja
 * en `x_project_id`.
 */
export async function pushActualLine(input: {
  projectId: number;
  accountId: number | undefined;
  companyId: number;
  category: CostCategory;
  concept: string;
  date: string;
  amount: number;
  source: "manual" | "gasto_campo" | "faltante" | "compra";
  reference?: string;
  registeredBy?: string;
  capturedBy?: string;
  hasReceipt?: boolean;
}): Promise<number> {
  return create("account.analytic.line", {
    name: input.concept,
    date: input.date,
    // El costo es negativo en la analítica, como cualquier gasto de Odoo.
    amount: -Math.abs(input.amount),
    unit_amount: 0,
    account_id: input.accountId ?? false,
    company_id: input.companyId,
    x_project_id: input.projectId,
    x_partida: input.category,
    x_source: input.source,
    ref: input.reference ?? false,
    x_registered_by: input.registeredBy ?? false,
    x_captured_by: input.capturedBy ?? false,
    x_has_receipt: input.hasReceipt ?? false,
  });
}

async function projectMeta(
  id: number,
): Promise<{ id: number; folio: string; accountId?: number; companyId: number; name: string } | null> {
  const rows = await searchRead<{
    id: number;
    name: string;
    x_folio: string | false;
    account_id: Many2One;
    company_id: Many2One;
  }>("project.project", [["id", "=", id]], {
    fields: ["id", "name", "x_folio", "account_id", "company_id"],
  });
  if (rows.length === 0) return null;
  return {
    id: rows[0].id,
    name: rows[0].name,
    folio: rows[0].x_folio || "",
    accountId: m2oId(rows[0].account_id),
    companyId: m2oId(rows[0].company_id) ?? 1,
  };
}

async function respondWithProject(id: number) {
  const row = await loadProjectById(id);
  if (!row) return notFound("El proyecto no existe.");
  return json(row);
}

// ---------------------------------------------------------------------------
// Despachador
// ---------------------------------------------------------------------------

export async function handleProjects(action: string, payload: Payload, session: SessionPayload) {
  switch (action) {
    /** Directorio único de proyectos. [R-01] [R-02] */
    case "list": {
      const term = search(payload.search);
      const area = str(payload.area);
      const stage = str(payload.stage);
      const company = str(payload.company);

      const domain: unknown[] = [];
      if (area && area !== "todas") domain.push(["x_area", "=", area]);
      if (stage && stage !== "todas") {
        const stageId = await stageIdOf(stage);
        if (stageId) domain.push(["stage_id", "=", stageId]);
      }
      if (company && company !== "todas") {
        domain.push(["company_id", "=", await companyIdOf(company)]);
      }

      let rows = await loadProjects(domain);

      if (term) {
        rows = rows.filter((row) =>
          contains(term, row.folio, row.name, row.client, row.site, row.supervisor),
        );
      }
      if (payload.only_overrun === true) {
        rows = rows.filter((row) => row.totals.variance > 0);
      }

      return json({
        rows,
        total: rows.length,
        active: rows.filter((row) => isActiveStage(row.stage)).length,
        contracted: sum(rows.map((row) => row.totals.billable_total)),
        actual: sum(rows.map((row) => row.totals.actual_total)),
      });
    }

    case "get":
      return json(await loadProjectById(num(payload.id)));

    /** Columnas del kanban de etapas. */
    case "stages": {
      const { rows } = await getStages();
      return json({
        rows: rows.map((row) => ({ stage: row.code, label: row.name })),
      });
    }

    case "create": {
      const name = str(payload.name);
      if (!name) return badRequest("El nombre del trabajo es obligatorio.");

      const client = await resolveClient(payload);
      if ("error" in client) return badRequest(client.error);

      const measurements = Array.isArray(payload.measurements)
        ? (payload.measurements as Payload[])
            .map((row) => ({
              label: str(row.label) ?? "Medida",
              value: num(row.value, 0),
              unit: str(row.unit) ?? "m²",
            }))
            .filter((row) => row.value > 0)
        : [];
      const doneBy = str(payload.done_by) ?? session.name;
      if (!str(payload.site)) return badRequest("Captura el sitio.");
      if (!doneBy) return badRequest("Captura quién fue al sitio.");
      if (!str(payload.conditions) && !str(payload.notes)) {
        return badRequest("Describe las condiciones del sitio.");
      }
      if (measurements.length === 0) return badRequest("Captura al menos una medida.");

      const projectId = await createProjectRecord({
        name,
        clientId: client.id,
        site: str(payload.site),
        area: (str(payload.area) ?? "limpieza") as ProjectArea,
        company: str(payload.company) ?? "altitude",
        supervisorId: num(payload.supervisor_id, 0) || undefined,
        coordinatorId: num(payload.coordinator_id, 0) || session.uid,
        startDate: str(payload.start_date) ?? str(payload.survey_date),
        endDate: str(payload.end_date),
        contractAmount: 0,
        notes: str(payload.notes),
        stage: "levantamiento",
        surveyDoneBy: doneBy,
        surveyDate: str(payload.survey_date) ?? dayIso(0),
        surveyNotes: str(payload.conditions) ?? str(payload.notes),
        surveyMeasurements: JSON.stringify(measurements),
      });

      if (Array.isArray(payload.photos)) {
        await attachSurveyPhotos(projectId, payload.photos as Payload[], doneBy);
      }

      const meta = await projectMeta(projectId);
      await postNote(
        "project.project",
        projectId,
        `Levantamiento ${meta?.folio ?? ""} registrado. La cotización se arma después, desde este mismo registro.`,
        session,
      );
      return respondWithProject(projectId);
    }

    case "update": {
      const id = num(payload.id);
      const meta = await projectMeta(id);
      if (!meta) return notFound("El proyecto no existe.");

      const values: Record<string, unknown> = {};
      if (str(payload.name)) values.name = str(payload.name);
      if (payload.site !== undefined) values.x_sitio = str(payload.site) ?? false;
      if (payload.supervisor_id !== undefined) {
        values.user_id = num(payload.supervisor_id, 0) || false;
      }
      if (payload.coordinator_id !== undefined) {
        values.x_coordinator_id = num(payload.coordinator_id, 0) || false;
      }
      if (str(payload.start_date)) values.date_start = str(payload.start_date);
      if (payload.end_date !== undefined) values.date = str(payload.end_date) ?? false;
      if (payload.contract_amount !== undefined) {
        values.x_contract_amount = num(payload.contract_amount, 0);
      }
      if (payload.notes !== undefined) values.x_notes = str(payload.notes) ?? false;
      if (payload.client_id !== undefined || payload.client !== undefined) {
        const client = await resolveClient(payload);
        if ("error" in client) return badRequest(client.error);
        values.partner_id = client.id;
      }

      if (Object.keys(values).length > 0) await write("project.project", [id], values);
      return respondWithProject(id);
    }

    /** Medidas, condiciones y fotos del sitio. Es el lead, antes de cotizar. */
    case "saveSurvey": {
      const id = num(payload.id);
      const meta = await projectMeta(id);
      if (!meta) return notFound("El proyecto no existe.");

      const measurements = Array.isArray(payload.measurements)
        ? (payload.measurements as Payload[])
            .map((row) => ({
              label: str(row.label) ?? "Medida",
              value: num(row.value, 0),
              unit: str(row.unit) ?? "m²",
            }))
            .filter((row) => row.value > 0)
        : [];
      const doneBy = str(payload.done_by) ?? session.name;

      const values: Record<string, unknown> = {
        x_survey_done_by: doneBy,
        x_survey_date: str(payload.survey_date) ?? dayIso(0),
        x_survey_notes: str(payload.conditions) ?? str(payload.notes) ?? false,
        x_survey_measurements: JSON.stringify(measurements),
      };
      if (str(payload.name)) values.name = str(payload.name);
      if (payload.site !== undefined) values.x_sitio = str(payload.site) ?? false;
      if (payload.client_id !== undefined || payload.client !== undefined) {
        const client = await resolveClient(payload);
        if ("error" in client) return badRequest(client.error);
        values.partner_id = client.id;
      }

      await write("project.project", [id], values);

      if (Array.isArray(payload.photos)) {
        await attachSurveyPhotos(id, payload.photos as Payload[], doneBy);
      }

      return respondWithProject(id);
    }

    /** Mover de etapa: el gesto del kanban. Odoo trackea el cambio solo. */
    case "setStage": {
      const id = num(payload.id);
      const stage = str(payload.stage) as ProjectStage | undefined;
      if (!stage || !(stage in STAGE_LABELS)) return badRequest("Etapa inválida.");

      const meta = await projectMeta(id);
      if (!meta) return notFound("El proyecto no existe.");

      const stageId = await stageIdOf(stage);
      if (!stageId) return badRequest("Esa etapa no está configurada en el ERP.");
      await write("project.project", [id], { stage_id: stageId });
      return respondWithProject(id);
    }

    /** Carga del presupuesto base, partida por partida. [R-03] */
    case "saveBudget": {
      const id = num(payload.id);
      const meta = await projectMeta(id);
      if (!meta) return notFound("El proyecto no existe.");

      const rawLines = Array.isArray(payload.lines) ? (payload.lines as Payload[]) : [];
      if (rawLines.length === 0) return badRequest("Captura al menos una partida.");

      const values: Record<string, unknown>[] = [];
      for (const [index, raw] of rawLines.entries()) {
        const category = validCategory(raw.category);
        if (!category) {
          return badRequest(`La partida "${str(raw.category)}" no existe.`);
        }
        values.push({
          project_id: id,
          sequence: (index + 1) * 10,
          category,
          concept: str(raw.concept) ?? "Concepto",
          unit: str(raw.unit) ?? "lote",
          qty: num(raw.qty, 1),
          unit_cost: num(raw.unit_cost, 0),
          notes: str(raw.notes) ?? false,
        });
      }

      const current = await searchRead<{ id: number; amount: number }>(
        "altitud.budget.line",
        [["project_id", "=", id]],
        { fields: ["id", "amount"] },
      );
      const before = sum(current.map((line) => line.amount));

      // El presupuesto se reemplaza completo, pero primero se escribe el
      // nuevo y hasta entonces se borra el viejo: si la escritura falla a
      // medias, el proyecto se queda con su presupuesto, no sin ninguno.
      await createMany("altitud.budget.line", values);
      if (current.length > 0) {
        await unlink("altitud.budget.line", current.map((line) => line.id));
      }

      const after = sum(
        rawLines.map((raw) => round2(num(raw.qty, 1) * num(raw.unit_cost, 0))),
      );
      await postNote(
        "project.project",
        id,
        `Se actualizó el presupuesto base: de ${before.toFixed(2)} a ${after.toFixed(2)}.`,
        session,
      );
      return respondWithProject(id);
    }

    /** Gasto real capturado a mano (lo demás llega de compras y asistencias). [R-04] */
    case "addActual": {
      const id = num(payload.id);
      const meta = await projectMeta(id);
      if (!meta) return notFound("El proyecto no existe.");
      const amount = num(payload.amount, 0);
      if (amount <= 0) return badRequest("El importe debe ser mayor a cero.");
      const categoria = validCategory(payload.category);
      if (!categoria) return badRequest(`La partida "${str(payload.category)}" no existe.`);

      await pushActualLine({
        projectId: id,
        accountId: meta.accountId,
        companyId: meta.companyId,
        category: categoria,
        concept: str(payload.concept) ?? "Gasto",
        date: str(payload.date) ?? dayIso(0),
        amount,
        source: "manual",
        reference: str(payload.reference),
        registeredBy: str(payload.registered_by) ?? session.name,
      });
      return respondWithProject(id);
    }

    /** Gasto capturado desde el sitio. [R-27] */
    case "addFieldExpense": {
      const id = num(payload.id);
      const meta = await projectMeta(id);
      if (!meta) return notFound("El proyecto no existe.");
      const amount = num(payload.amount, 0);
      if (amount <= 0) return badRequest("El importe debe ser mayor a cero.");

      const categoriaCampo = validCategory(payload.category, "gastos_operativos");
      if (!categoriaCampo) return badRequest(`La partida "${str(payload.category)}" no existe.`);

      const photoData = str(payload.photo_data);
      await callKw("account.analytic.line", "altitud_gasto_campo", [id, amount], {
        concept: str(payload.concept) ?? "Gasto de campo",
        category: categoriaCampo,
        date: str(payload.date) ?? dayIso(0),
        captured_by: str(payload.captured_by) ?? session.name,
        has_receipt: payload.has_receipt === true || Boolean(photoData),
        photo_name: str(payload.photo_name) ?? false,
        photo_data: photoData ?? false,
        photo_mimetype: str(payload.photo_mimetype) ?? false,
      });
      return respondWithProject(id);
    }

    /**
     * Padrón activo para el responsable de una fase.
     *
     * No mira la cuadrilla ni las asistencias: cualquier colaborador vigente
     * se puede elegir.
     */
    case "employees": {
      await getCompanies();
      const rows = await searchRead<{
        id: number;
        name: string;
        job_title: string | false;
      }>("hr.employee", [["active", "=", true]], {
        fields: ["id", "name", "job_title"],
        order: "name",
      });
      return json({
        rows: rows.map((row) => ({
          id: row.id,
          name: row.name,
          job: row.job_title || "",
        })),
      });
    }

    /** Avance por fase y su responsable. [R-05] [R-28] */
    case "setPhase": {
      const id = num(payload.id);
      const before = await loadProjectById(id);
      if (!before) return notFound("El proyecto no existe.");

      const phaseId = num(payload.phase_id);
      const phase = before.phases.find((row) => row.id === phaseId);
      if (!phase) return notFound("La fase no existe.");

      const values: Record<string, unknown> = {};
      let progress = phase.progress;
      if (payload.progress !== undefined) {
        progress = Math.max(0, Math.min(100, num(payload.progress, phase.progress)));
        values.x_progress = progress;
        values.x_done_date = progress >= 100 ? dayIso(0) : false;
      }
      if (payload.due_date !== undefined) {
        const due = str(payload.due_date);
        values.date_deadline = due ? `${due} 12:00:00` : false;
      }

      let assigneeNote: string | undefined;
      if (payload.assignee_id !== undefined) {
        const assigneeId = num(payload.assignee_id, 0);
        const previousId = phase.assignee_id ?? 0;
        if (!assigneeId) {
          values.x_assignee_id = false;
          if (previousId) assigneeNote = `${phase.name}: quedó sin responsable.`;
        } else {
          const found = await searchRead<{ id: number; name: string }>(
            "hr.employee",
            [["id", "=", assigneeId]],
            { fields: ["id", "name"], limit: 1, context: { active_test: false } },
          );
          if (found.length === 0) return badRequest("Ese colaborador no existe.");
          values.x_assignee_id = assigneeId;
          if (previousId !== assigneeId) {
            assigneeNote = `${phase.name}: responsable ${found[0].name}.`;
          }
        }
      }

      if (Object.keys(values).length > 0) {
        await write("project.task", [phaseId], values);
      }

      const previousProgress = computeProgress(before);
      const after = await loadProjectById(id);
      const currentProgress = after ? computeProgress(after) : previousProgress;
      if (payload.progress !== undefined && currentProgress !== previousProgress) {
        await postNote(
          "project.project",
          id,
          `${phase.name}: avance al ${progress}%. El proyecto pasa de ${previousProgress}% a ${currentProgress}%.`,
          session,
        );
      }
      if (assigneeNote) {
        await postNote("project.project", id, assigneeNote, session);
      }
      return json(after);
    }

    /** Extras y faltantes. [R-06] */
    case "addExtra": {
      const id = num(payload.id);
      const meta = await projectMeta(id);
      if (!meta) return notFound("El proyecto no existe.");
      const amount = num(payload.amount, 0);
      if (amount <= 0) return badRequest("El importe debe ser mayor a cero.");

      const kind = str(payload.kind) === "faltante" ? "faltante" : "extra";
      const category = validCategory(payload.category);
      if (!category) return badRequest(`La partida "${str(payload.category)}" no existe.`);
      const concept = str(payload.concept) ?? "Extra";
      const date = str(payload.date) ?? dayIso(0);
      const billable = payload.billable === true;

      // El registro del extra va primero. Si fuera al revés y el alta del
      // extra fallara, el gasto del faltante se quedaría suelto en la
      // analítica, sumando al costo del proyecto sin que nada lo explique.
      const extraId = await create("altitud.extra", {
        project_id: id,
        kind,
        category,
        concept,
        amount,
        date,
        billable,
        approved_by: billable ? (str(payload.approved_by) ?? session.name) : false,
      });

      // Un faltante es costo que no se contempló: pega en el gasto real.
      if (kind === "faltante") {
        const lineId = await pushActualLine({
          projectId: id,
          accountId: meta.accountId,
          companyId: meta.companyId,
          category,
          concept: `Faltante: ${concept}`,
          date,
          amount,
          source: "faltante",
          reference: "Faltante",
          registeredBy: session.name,
        });
        await write("altitud.extra", [extraId], { analytic_line_id: lineId });
      }

      await postNote(
        "project.project",
        id,
        `${kind === "extra" ? "Extra" : "Faltante"} registrado: ${concept} por ${amount.toFixed(2)}.`,
        session,
      );
      return respondWithProject(id);
    }

    /** Evidencia fotográfica desde el proyecto. [R-26] */
    case "addEvidence": {
      const id = num(payload.id);
      const meta = await projectMeta(id);
      if (!meta) return notFound("El proyecto no existe.");

      await create("ir.attachment", {
        name: str(payload.title) ?? "Evidencia",
        res_model: "project.project",
        res_id: id,
        // Mientras la pantalla no suba archivo, el adjunto guarda la ficha de
        // la evidencia y el marcador de color que ya pinta la UI.
        description: serializeEvidenceMeta({
          phase: str(payload.phase),
          author: str(payload.author) ?? session.name,
          placeholder: str(payload.placeholder) ?? "altura-1",
          note: str(payload.note),
        }),
        ...(str(payload.datas)
          ? { datas: str(payload.datas), mimetype: str(payload.mimetype) ?? "image/jpeg" }
          : { raw: "" }),
      });
      return respondWithProject(id);
    }

    /** Cierre con comparativo y rentabilidad. [R-07] */
    case "close": {
      const id = num(payload.id);
      const project = await loadProjectById(id);
      if (!project) return notFound("El proyecto no existe.");

      const invoiced = num(payload.invoiced_amount, 0);
      if (invoiced <= 0) return badRequest("Captura el monto facturado para poder cerrar.");

      const refs = Array.isArray(payload.invoice_refs)
        ? (payload.invoice_refs as unknown[]).map((ref) => String(ref)).filter(Boolean)
        : str(payload.invoice_refs)
          ? [str(payload.invoice_refs)!]
          : [];

      const cerrado = await stageIdOf("cerrado");
      await write("project.project", [id], {
        x_invoiced_amount: invoiced,
        x_invoice_refs: refs.join(", "),
        x_closed_at: dayIso(0),
        x_closed_by: str(payload.closed_by) ?? session.name,
        x_closure_notes: str(payload.notes) ?? false,
        stage_id: cerrado ?? false,
      });

      // Cerrar deja las fases al 100 %: el trabajo se entregó.
      const phaseIds = project.phases.map((phase) => phase.id);
      if (phaseIds.length > 0) {
        await write("project.task", phaseIds, {
          x_progress: 100,
          x_done_date: dayIso(0),
        });
      }

      await postNote(
        "project.project",
        id,
        `Proyecto cerrado con comparativo presupuestado / real / facturado. Facturado: ${invoiced.toFixed(2)}.`,
        session,
      );
      return respondWithProject(id);
    }

    /** Reabrir un cierre por si se capturó mal. */
    case "reopen": {
      const id = num(payload.id);
      const meta = await projectMeta(id);
      if (!meta) return notFound("El proyecto no existe.");

      const porCerrar = await stageIdOf("por_cerrar");
      await write("project.project", [id], {
        x_invoiced_amount: 0,
        x_invoice_refs: false,
        x_closed_at: false,
        x_closed_by: false,
        x_closure_notes: false,
        stage_id: porCerrar ?? false,
      });
      await postNote("project.project", id, "Cierre reabierto para corregir información.", session);
      return respondWithProject(id);
    }

    // -----------------------------------------------------------------
    // Cuadrilla: quién puede marcar asistencia en este proyecto
    // -----------------------------------------------------------------
    case "crew": {
      const id = num(payload.id ?? payload.project_id);
      if (!id) return badRequest("Selecciona el proyecto.");

      const rows = await searchRead<{
        id: number;
        employee_id: Many2One;
        active: boolean;
        date_from: string | false;
      }>("altitud.crew", [["project_id", "=", id], ["active", "in", [true, false]]], {
        fields: ["id", "employee_id", "active", "date_from"],
        order: "id",
      });

      const employeeIds = rows.map((row) => m2oId(row.employee_id) ?? 0).filter(Boolean);
      const employees = employeeIds.length
        ? await searchRead<{
            id: number;
            name: string;
            job_title: string | false;
            x_area: string | false;
            x_jornal: number;
          }>("hr.employee", [["id", "in", employeeIds]], {
            fields: ["id", "name", "job_title", "x_area", "x_jornal"],
          })
        : [];
      const byId = new Map(employees.map((employee) => [employee.id, employee]));

      return json({
        rows: rows.map((row) => {
          const employee = byId.get(m2oId(row.employee_id) ?? 0);
          return {
            id: row.id,
            employee_id: m2oId(row.employee_id) ?? 0,
            employee_name: employee?.name ?? "",
            job: employee?.job_title || "",
            area: employee?.x_area || "mixto",
            jornal: employee?.x_jornal ?? 0,
            active: row.active,
            date_from: row.date_from || undefined,
          };
        }),
        total: rows.length,
      });
    }

    case "assignCrew": {
      const projectId = num(payload.id ?? payload.project_id);
      const meta = await projectMeta(projectId);
      if (!meta) return notFound("El proyecto no existe.");

      const employeeIds = Array.isArray(payload.employee_ids)
        ? (payload.employee_ids as unknown[]).map((value) => num(value)).filter(Boolean)
        : [num(payload.employee_id)].filter(Boolean);
      if (employeeIds.length === 0) return badRequest("Selecciona al menos un colaborador.");

      const existing = await searchRead<{ id: number; employee_id: Many2One; active: boolean }>(
        "altitud.crew",
        [
          ["project_id", "=", projectId],
          ["employee_id", "in", employeeIds],
          ["active", "in", [true, false]],
        ],
        { fields: ["id", "employee_id", "active"] },
      );
      const existingByEmployee = new Map(
        existing.map((row) => [m2oId(row.employee_id) ?? 0, row]),
      );

      const toCreate = employeeIds.filter((id) => !existingByEmployee.has(id));
      // Volver a asignar a alguien que ya estuvo solo lo reactiva: su
      // historial de asistencias se conserva.
      const toReactivate = existing.filter((row) => !row.active).map((row) => row.id);

      if (toCreate.length > 0) {
        await createMany(
          "altitud.crew",
          toCreate.map((employeeId) => ({
            project_id: projectId,
            employee_id: employeeId,
            date_from: str(payload.date_from) ?? dayIso(0),
          })),
        );
      }
      if (toReactivate.length > 0) {
        await write("altitud.crew", toReactivate, { active: true });
      }

      return handleProjects("crew", { id: projectId }, session);
    }

    case "unassignCrew": {
      const projectId = num(payload.id ?? payload.project_id);
      const crewId = num(payload.crew_id, 0);
      const employeeId = num(payload.employee_id, 0);

      const domain: unknown[] = crewId
        ? [["id", "=", crewId]]
        : [
            ["project_id", "=", projectId],
            ["employee_id", "=", employeeId],
          ];
      const rows = await searchRead<{ id: number; project_id: Many2One }>("altitud.crew", domain, {
        fields: ["id", "project_id"],
      });
      if (rows.length === 0) return notFound("Esa persona no está en la cuadrilla.");

      // Se archiva, no se borra: las asistencias que ya tiene se conservan.
      await write("altitud.crew", rows.map((row) => row.id), { active: false });
      return handleProjects(
        "crew",
        { id: projectId || m2oId(rows[0].project_id) },
        session,
      );
    }

    default:
      return unknownAction(action);
  }
}

async function attachSurveyPhotos(projectId: number, photos: Payload[], author: string) {
  for (const photo of photos) {
    const datas = str(photo.datas);
    if (!datas) continue;
    await create("ir.attachment", {
      name: str(photo.title) ?? str(photo.name) ?? "Foto de sitio",
      res_model: "project.project",
      res_id: projectId,
      datas,
      mimetype: str(photo.mimetype) ?? "image/jpeg",
      description: serializeEvidenceMeta({
        kind: "survey",
        author,
        placeholder: str(photo.placeholder) ?? "altura-1",
        note: str(photo.note),
      }),
    });
  }
}

/** Siguiente folio de una secuencia de Odoo. */
export async function nextSequence(code: string): Promise<string> {
  const { callKw } = await import("@/lib/odoo/client");
  const value = await callKw<string | false>("ir.sequence", "next_by_code", [code]);
  return value || code;
}
