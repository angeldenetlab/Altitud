import type {
  CostCategory,
  ProjectArea,
  Quote,
  QuoteApproval,
  QuoteLine,
  QuoteOrigin,
  QuoteStatus,
  ServiceItem,
} from "@/types/altitude";
import { CATEGORY_LABELS, QUOTE_STATUS_LABELS } from "@/lib/labels";
import { contains, dayIso, num, round2, search, str, sum } from "@/lib/compute";
import { badRequest, json, notFound, type Payload, unknownAction } from "@/lib/http";
import type { SessionPayload } from "@/lib/auth/server-session";
import {
  type Many2One,
  callKw,
  create,
  createMany,
  m2oId,
  m2oName,
  searchRead,
  unlink,
  write,
} from "@/lib/odoo/client";
import {
  companyCodeOf,
  companyIdOf,
  parseMeasurements,
  resolveClient,
  serializeEvidenceMeta,
  stageIdOf,
} from "@/server/erp/common";
import { budgetSeedFromCost, createProjectRecord } from "@/server/erp/projects";
import { postNote } from "@/server/erp/chatter";

/**
 * Presupuestos y cotizaciones. [R-09] … [R-16]
 *
 * La cotización es un `sale.order`. El flujo interno de Altitud
 * (levantamiento → cálculo → visto bueno del socio → enviada → autorizada)
 * no existe en Odoo, que solo sabe de borrador / enviado / confirmado, así
 * que vive en `x_status`. Autorizar es lo único que mueve el `state` nativo:
 * confirma el pedido.
 */

const QUOTE_FIELDS = [
  "id",
  "x_folio",
  "name",
  "x_title",
  "partner_id",
  "company_id",
  "x_area",
  "x_status",
  "date_order",
  "validity_date",
  "x_owner",
  "x_overhead_pct",
  "amount_untaxed",
  "x_cost_total",
  "x_jornales_total",
  "x_approvals",
  "project_id",
  "x_origin",
  "x_notes",
  "x_survey_done_by",
  "x_survey_date",
  "x_survey_notes",
  "x_survey_measurements",
  "order_line",
];

interface OdooQuote {
  id: number;
  x_folio: string | false;
  name: string;
  x_title: string | false;
  partner_id: Many2One;
  company_id: Many2One;
  x_area: ProjectArea | false;
  x_status: QuoteStatus | false;
  date_order: string;
  validity_date: string | false;
  x_owner: string | false;
  x_overhead_pct: number;
  amount_untaxed: number;
  x_cost_total: number;
  x_jornales_total: number;
  x_approvals: string | false;
  project_id: Many2One;
  x_origin: QuoteOrigin | false;
  x_notes: string | false;
  x_survey_done_by: string | false;
  x_survey_date: string | false;
  x_survey_notes: string | false;
  x_survey_measurements: string | false;
  order_line: number[];
}

interface OdooQuoteLine {
  id: number;
  order_id: Many2One;
  product_id: Many2One;
  name: string;
  product_uom_qty: number;
  price_unit: number;
  price_subtotal: number;
  x_cost_unit: number;
  x_jornales: number;
  product_uom: Many2One;
}

const LINE_FIELDS = [
  "id",
  "order_id",
  "product_id",
  "name",
  "product_uom_qty",
  "price_unit",
  "price_subtotal",
  "x_cost_unit",
  "x_jornales",
  "product_uom",
];

// ---------------------------------------------------------------------------
// Catálogo de servicios
// ---------------------------------------------------------------------------

interface OdooService {
  id: number;
  default_code: string | false;
  name: string;
  x_area: ProjectArea | false;
  uom_id: Many2One;
  list_price: number;
  standard_price: number;
  x_yield_per_jornal: number;
  active: boolean;
  product_variant_id: Many2One;
}

const SERVICE_FIELDS = [
  "id",
  "default_code",
  "name",
  "x_area",
  "uom_id",
  "list_price",
  "standard_price",
  "x_yield_per_jornal",
  "active",
  "product_variant_id",
];

function toService(row: OdooService): ServiceItem {
  return {
    id: row.id,
    code: row.default_code || `SRV-${row.id}`,
    name: row.name,
    area: (row.x_area || "limpieza") as ProjectArea,
    unit: m2oName(row.uom_id) ?? "servicio",
    price_unit: round2(row.list_price),
    cost_unit: round2(row.standard_price),
    yield_per_jornal: row.x_yield_per_jornal || 1,
    active: row.active,
  };
}

async function readServices(domain: unknown[] = []): Promise<OdooService[]> {
  return searchRead<OdooService>(
    "product.template",
    [["type", "=", "service"], ["x_area", "!=", false], ...domain],
    { fields: SERVICE_FIELDS, order: "default_code" },
  );
}

/**
 * Producto genérico para las partidas libres: extras de obra, trabajo
 * adicional capturado a mano y la formalización de un proyecto que se abrió
 * sin cotización. No tienen servicio del catálogo ni rendimiento.
 */
const FREE_PRODUCT_CODE = "ALT-PARTIDA";

let freeProductId: number | null = null;

async function getFreeServiceProduct(): Promise<number> {
  if (freeProductId) return freeProductId;

  const existing = await searchRead<{ id: number }>(
    "product.product",
    [["default_code", "=", FREE_PRODUCT_CODE]],
    { fields: ["id"], limit: 1, context: { active_test: false } },
  );
  if (existing[0]) {
    freeProductId = existing[0].id;
    return freeProductId;
  }

  const templateId = await create("product.template", {
    name: "Partida de cotización",
    default_code: FREE_PRODUCT_CODE,
    type: "service",
    sale_ok: true,
    purchase_ok: false,
    list_price: 0,
  });
  const template = await searchRead<{ id: number; product_variant_id: Many2One }>(
    "product.template",
    [["id", "=", templateId]],
    { fields: ["id", "product_variant_id"] },
  );
  freeProductId = m2oId(template[0]?.product_variant_id) ?? 0;
  return freeProductId;
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

function parseApprovals(raw: string | false): QuoteApproval[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QuoteApproval[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function hydrateQuotes(orders: OdooQuote[]): Promise<Quote[]> {
  if (orders.length === 0) return [];

  const lineIds = orders.flatMap((order) => order.order_line);
  const [lines, photos, projects] = await Promise.all([
    lineIds.length
      ? searchRead<OdooQuoteLine>("sale.order.line", [["id", "in", lineIds]], {
          fields: LINE_FIELDS,
          order: "sequence, id",
        })
      : Promise.resolve([]),
    searchRead<{ id: number; res_id: number; name: string; description: string | false }>(
      "ir.attachment",
      [
        ["res_model", "=", "sale.order"],
        ["res_id", "in", orders.map((order) => order.id)],
      ],
      { fields: ["id", "res_id", "name", "description"] },
    ),
    (async () => {
      const ids = orders.map((order) => m2oId(order.project_id) ?? 0).filter(Boolean);
      return ids.length
        ? searchRead<{ id: number; x_folio: string | false }>(
            "project.project",
            [["id", "in", ids]],
            { fields: ["id", "x_folio"] },
          )
        : [];
    })(),
  ]);

  const linesByOrder = new Map<number, OdooQuoteLine[]>();
  lines.forEach((line) => {
    const orderId = m2oId(line.order_id) ?? 0;
    const list = linesByOrder.get(orderId) ?? [];
    list.push(line);
    linesByOrder.set(orderId, list);
  });

  const photosByOrder = new Map<number, { id: number; title: string; placeholder: string }[]>();
  photos.forEach((photo) => {
    let placeholder = "altura-1";
    try {
      const meta = JSON.parse(photo.description || "{}") as { placeholder?: string };
      if (meta.placeholder) placeholder = meta.placeholder;
    } catch {
      /* el adjunto no trae ficha: se queda con el marcador por omisión */
    }
    const list = photosByOrder.get(photo.res_id) ?? [];
    list.push({ id: photo.id, title: photo.name, placeholder });
    photosByOrder.set(photo.res_id, list);
  });

  const folioByProject = new Map(projects.map((project) => [project.id, project.x_folio || ""]));

  /**
   * El catálogo de servicios devuelve ids de `product.template`, pero la
   * partida del pedido apunta a `product.product`. Sin esta traducción la
   * pantalla nunca empata la partida con su servicio.
   *
   * El producto genérico de las partidas libres (`ALT-PARTIDA`) se reconoce
   * por su código, no por un id en memoria: así vale desde la primera lectura
   * del proceso, aunque todavía nadie haya creado una cotización.
   */
  const productIds = [...new Set(lines.map((line) => m2oId(line.product_id) ?? 0))].filter(Boolean);
  const products = productIds.length
    ? await searchRead<{ id: number; product_tmpl_id: Many2One; default_code: string | false }>(
        "product.product",
        [["id", "in", productIds]],
        { fields: ["id", "product_tmpl_id", "default_code"], context: { active_test: false } },
      )
    : [];
  const templateByProduct = new Map<number, number>();
  const freeProductIds = new Set<number>();
  products.forEach((product) => {
    const templateId = m2oId(product.product_tmpl_id);
    if (templateId) templateByProduct.set(product.id, templateId);
    if (product.default_code === FREE_PRODUCT_CODE) freeProductIds.add(product.id);
  });

  return Promise.all(
    orders.map(async (order): Promise<Quote> => {
      const orderLines = (linesByOrder.get(order.id) ?? []).map(
        (line): QuoteLine => ({
          id: line.id,
          // El producto genérico no es un servicio del catálogo: va como 0
          // para que la pantalla lo trate como partida libre.
          service_id: freeProductIds.has(m2oId(line.product_id) ?? 0)
            ? 0
            : (templateByProduct.get(m2oId(line.product_id) ?? 0) ?? 0),
          service_name: line.name,
          unit: m2oName(line.product_uom) ?? "servicio",
          qty: line.product_uom_qty,
          price_unit: round2(line.price_unit),
          cost_unit: round2(line.x_cost_unit),
          amount: round2(line.price_subtotal),
          jornales: round2(line.x_jornales),
        }),
      );

      const projectId = m2oId(order.project_id);
      const measurements = parseMeasurements(order.x_survey_measurements);
      const surveyPhotos = photosByOrder.get(order.id) ?? [];

      return {
        id: order.id,
        folio: order.x_folio || order.name,
        name: order.x_title || order.name,
        client_id: m2oId(order.partner_id),
        client: m2oName(order.partner_id) ?? "Sin cliente",
        company: await companyCodeOf(m2oId(order.company_id)),
        area: (order.x_area || "limpieza") as ProjectArea,
        status: (order.x_status || "levantamiento") as QuoteStatus,
        date: order.date_order.slice(0, 10),
        valid_until: order.validity_date || dayIso(15),
        owner: order.x_owner || "Sin responsable",
        survey:
          order.x_survey_done_by || measurements.length > 0 || surveyPhotos.length > 0
            ? {
                done_by: order.x_survey_done_by || order.x_owner || "Sin responsable",
                date: order.x_survey_date || order.date_order.slice(0, 10),
                measurements,
                photos: surveyPhotos,
                notes: order.x_survey_notes || undefined,
              }
            : undefined,
        lines: orderLines,
        overhead_pct: order.x_overhead_pct,
        amount_total: round2(order.amount_untaxed),
        cost_total: round2(order.x_cost_total),
        jornales_total: round2(order.x_jornales_total),
        approvals: parseApprovals(order.x_approvals),
        project_folio: projectId ? folioByProject.get(projectId) : undefined,
        project_id: projectId,
        origin: order.x_origin || undefined,
        notes: order.x_notes || undefined,
      };
    }),
  );
}

async function readQuote(id: number): Promise<Quote | null> {
  const orders = await searchRead<OdooQuote>("sale.order", [["id", "=", id]], {
    fields: QUOTE_FIELDS,
  });
  if (orders.length === 0) return null;
  const [quote] = await hydrateQuotes(orders);
  return quote ?? null;
}

// ---------------------------------------------------------------------------
// Escritura de partidas y totales
// ---------------------------------------------------------------------------

interface LineInput {
  productId: number;
  name: string;
  qty: number;
  priceUnit: number;
  costUnit: number;
  jornales: number;
  uomId?: number;
}

/**
 * Convierte lo que manda la pantalla en partidas de pedido.
 *
 * Los jornales salen del rendimiento del servicio: cantidad / rendimiento.
 * [R-12] Una partida libre no tiene rendimiento, así que respeta lo que
 * venga capturado.
 */
async function buildLines(raw: Payload[]): Promise<LineInput[]> {
  const serviceIds = raw.map((line) => num(line.service_id, 0)).filter(Boolean);
  const services = serviceIds.length
    ? await readServices([["id", "in", [...new Set(serviceIds)]]])
    : [];
  const byId = new Map(services.map((service) => [service.id, service]));
  const freeProduct = await getFreeServiceProduct();

  return Promise.all(
    raw.map(async (line): Promise<LineInput> => {
      const service = byId.get(num(line.service_id, 0));
      const qty = Math.max(0, num(line.qty, 0));

      if (!service) {
        return {
          productId: freeProduct,
          name: str(line.service_name) ?? "Partida",
          qty,
          priceUnit: num(line.price_unit, 0),
          costUnit: num(line.cost_unit, 0),
          jornales: num(line.jornales, 0),
        };
      }

      const yieldPerJornal = service.x_yield_per_jornal || 1;
      return {
        productId: m2oId(service.product_variant_id) ?? freeProduct,
        name: `[${service.default_code || service.id}] ${service.name}`,
        qty,
        priceUnit: num(line.price_unit, service.list_price) || service.list_price,
        costUnit: num(line.cost_unit, service.standard_price) || service.standard_price,
        jornales: round2(qty / (yieldPerJornal || 1)),
        uomId: m2oId(service.uom_id),
      };
    }),
  );
}

async function writeLines(orderId: number, lines: LineInput[]): Promise<void> {
  const current = await searchRead<{ id: number }>(
    "sale.order.line",
    [["order_id", "=", orderId]],
    { fields: ["id"] },
  );
  if (current.length > 0) {
    await unlink("sale.order.line", current.map((line) => line.id));
  }
  if (lines.length === 0) return;

  await createMany(
    "sale.order.line",
    lines.map((line, index) => ({
      order_id: orderId,
      sequence: (index + 1) * 10,
      product_id: line.productId,
      name: line.name,
      product_uom_qty: line.qty,
      price_unit: line.priceUnit,
      x_cost_unit: line.costUnit,
      x_jornales: line.jornales,
      ...(line.uomId ? { product_uom: line.uomId } : {}),
      // Sin impuestos: el front compara importes netos y la facturación
      // real vive en CONTPAQi. [R-35]
      tax_id: [[6, 0, []]],
    })),
  );
}

/** Costo con overhead y jornales del documento. [R-12] */
async function recalcTotals(orderId: number, overheadPct: number): Promise<void> {
  const lines = await searchRead<OdooQuoteLine>(
    "sale.order.line",
    [["order_id", "=", orderId]],
    { fields: LINE_FIELDS },
  );
  const direct = sum(lines.map((line) => line.product_uom_qty * line.x_cost_unit));
  await write("sale.order", [orderId], {
    x_cost_total: round2(direct * (1 + overheadPct / 100)),
    x_jornales_total: round2(lines.reduce((acc, line) => acc + line.x_jornales, 0)),
    x_overhead_pct: overheadPct,
  });
}

async function logStep(
  orderId: number,
  step: QuoteStatus,
  user: string,
  comment?: string,
): Promise<void> {
  const rows = await searchRead<{ id: number; x_approvals: string | false }>(
    "sale.order",
    [["id", "=", orderId]],
    { fields: ["id", "x_approvals"] },
  );
  const approvals = parseApprovals(rows[0]?.x_approvals ?? false);
  approvals.push({ step, user, date: dayIso(0), comment });
  await write("sale.order", [orderId], { x_approvals: JSON.stringify(approvals) });
}

// ---------------------------------------------------------------------------
// Despachador
// ---------------------------------------------------------------------------

export async function handleQuotes(action: string, payload: Payload, session: SessionPayload) {
  switch (action) {
    /** Seguimiento por folio y estatus. [R-15] */
    case "list": {
      const term = search(payload.search);
      const status = str(payload.status);
      const area = str(payload.area);

      const domain: unknown[] = [["x_folio", "!=", false]];
      if (status && status !== "todas") domain.push(["x_status", "=", status]);
      if (area && area !== "todas") domain.push(["x_area", "=", area]);

      const orders = await searchRead<OdooQuote>("sale.order", domain, {
        fields: QUOTE_FIELDS,
        order: "date_order desc, id desc",
      });
      let rows = await hydrateQuotes(orders);

      if (term) {
        rows = rows.filter((quote) =>
          contains(term, quote.folio, quote.name, quote.client, quote.owner),
        );
      }

      const pendingStates = ["levantamiento", "calculo", "vobo_socio", "enviada"];
      return json({
        rows,
        total: rows.length,
        pending: rows.filter((quote) => pendingStates.includes(quote.status)).length,
        authorized: rows.filter((quote) => quote.status === "autorizada").length,
        amount_pending: sum(
          rows
            .filter((quote) => ["vobo_socio", "enviada"].includes(quote.status))
            .map((quote) => quote.amount_total),
        ),
      });
    }

    case "get":
      return json(await readQuote(num(payload.id)));

    /** Catálogo de servicios con paramétricos. [R-10] [R-16] */
    case "services": {
      const rows = await readServices([["active", "=", true]]);
      return json({ rows: rows.map(toService) });
    }

    case "create": {
      const name = str(payload.name);
      if (!name) return badRequest("El nombre del trabajo es obligatorio.");

      const client = await resolveClient(payload);
      if ("error" in client) return badRequest(client.error);

      const company = str(payload.company) ?? "altitude";
      const owner = str(payload.owner) ?? session.name;
      const overhead = num(payload.overhead_pct, 22);

      const orderId = await create("sale.order", {
        name: await nextQuoteFolio(),
        x_title: name,
        partner_id: client.id,
        company_id: await companyIdOf(company),
        x_area: (str(payload.area) ?? "limpieza") as ProjectArea,
        x_status: "levantamiento",
        validity_date: dayIso(15),
        x_owner: owner,
        x_overhead_pct: overhead,
        x_notes: str(payload.notes) ?? false,
      });
      // El folio es el nombre del pedido: así se lee igual en Odoo y aquí.
      await write("sale.order", [orderId], { x_folio: await folioOf(orderId) });

      const lines = await buildLines(
        Array.isArray(payload.lines) ? (payload.lines as Payload[]) : [],
      );
      await writeLines(orderId, lines);
      await recalcTotals(orderId, overhead);
      await logStep(orderId, "levantamiento", owner);

      return json(await readQuote(orderId));
    }

    case "saveLines": {
      const id = num(payload.id);
      const quote = await readQuote(id);
      if (!quote) return notFound("La cotización no existe.");

      const overhead =
        payload.overhead_pct !== undefined
          ? num(payload.overhead_pct, quote.overhead_pct)
          : quote.overhead_pct;

      const lines = await buildLines(
        Array.isArray(payload.lines) ? (payload.lines as Payload[]) : [],
      );
      await writeLines(id, lines);
      await recalcTotals(id, overhead);

      // Capturar números saca la cotización del levantamiento. [R-13]
      if (quote.status === "levantamiento") {
        await write("sale.order", [id], { x_status: "calculo" });
      }
      return json(await readQuote(id));
    }

    /** Levantamiento delegable: fotos y medidas de quien esté en sitio. [R-11] */
    case "saveSurvey": {
      const id = num(payload.id);
      const quote = await readQuote(id);
      if (!quote) return notFound("La cotización no existe.");

      const measurements = Array.isArray(payload.measurements)
        ? (payload.measurements as Payload[]).map((row) => ({
            label: str(row.label) ?? "Medida",
            value: num(row.value, 0),
            unit: str(row.unit) ?? "m²",
          }))
        : [];

      await write("sale.order", [id], {
        x_survey_done_by: str(payload.done_by) ?? quote.owner,
        x_survey_date: dayIso(0),
        x_survey_notes: str(payload.notes) ?? false,
        x_survey_measurements: JSON.stringify(measurements),
      });

      if (Array.isArray(payload.photos)) {
        const photos = payload.photos as Payload[];
        for (const photo of photos) {
          await create("ir.attachment", {
            name: str(photo.title) ?? "Foto de sitio",
            res_model: "sale.order",
            res_id: id,
            description: serializeEvidenceMeta({
              placeholder: str(photo.placeholder) ?? "altura-1",
              author: str(payload.done_by) ?? quote.owner,
            }),
            ...(str(photo.datas)
              ? { datas: str(photo.datas), mimetype: str(photo.mimetype) ?? "image/jpeg" }
              : { raw: "" }),
          });
        }
      }

      return json(await readQuote(id));
    }

    /** Flujo de autorización interna. [R-13] */
    case "setStatus": {
      const id = num(payload.id);
      const quote = await readQuote(id);
      if (!quote) return notFound("La cotización no existe.");

      const status = str(payload.status) as QuoteStatus | undefined;
      if (!status || !(status in QUOTE_STATUS_LABELS)) return badRequest("Estatus inválido.");
      if (status === "autorizada") {
        return badRequest("Usa la acción de autorizar para llenar el proyecto.");
      }

      const user = str(payload.user) ?? session.name;
      await write("sale.order", [id], {
        x_status: status,
        ...(status === "vobo_socio" ? { x_vobo_socio: true } : {}),
      });
      await logStep(id, status, user, str(payload.comment));
      return json(await readQuote(id));
    }

    /**
     * Autorizar. [R-15]
     *
     * Dos caminos, y la diferencia importa: una cotización que nació de un
     * proyecto en marcha NO abre otro proyecto, se suma a lo cobrable del que
     * ya existe. Si no, se crea el proyecto con su presupuesto base.
     */
    case "authorize": {
      const id = num(payload.id);
      const quote = await readQuote(id);
      if (!quote) return notFound("La cotización no existe.");
      if (quote.lines.length === 0) return badRequest("Captura las partidas antes de autorizar.");

      /**
       * Autorizar son varias escrituras seguidas (estatus, proyecto, enlace,
       * confirmación) y cada una es una llamada aparte: no hay transacción que
       * las abrace. Si una se cae a medias, volver a autorizar tiene que
       * poder terminar el trabajo en lugar de rebotar con «ya está
       * autorizada» y dejar la cotización sin proyecto para siempre.
       */
      const yaAutorizada = quote.status === "autorizada";
      if (yaAutorizada && quote.project_id) {
        return badRequest("La cotización ya está autorizada.");
      }

      const user = str(payload.user) ?? session.name;

      // Caso A: ya cuelga de un proyecto.
      if (quote.project_id) {
        await write("sale.order", [id], { x_status: "autorizada" });
        await logStep(id, "autorizada", user, str(payload.comment));
        if (quote.origin === "inicial" || quote.origin === "levantamiento" || !quote.origin) {
          const autorizado = await stageIdOf("autorizado");
          await write("project.project", [quote.project_id], {
            x_contract_amount: quote.amount_total,
            x_quote_folio: quote.folio,
            ...(autorizado ? { stage_id: autorizado } : {}),
          });
          const existingBudget = await searchRead<{ id: number }>(
            "altitud.budget.line",
            [["project_id", "=", quote.project_id]],
            { fields: ["id"] },
          );
          const seed = budgetSeedFromCost(quote.area, quote.cost_total);
          if (seed.length > 0 && (existingBudget.length === 0 || quote.origin === "levantamiento")) {
            await createMany(
              "altitud.budget.line",
              seed.map((line, index) => ({
                project_id: quote.project_id,
                sequence: (index + 1) * 10,
                category: line.category,
                concept: line.concept,
                unit: line.unit,
                qty: line.qty,
                unit_cost: line.unit_cost,
              })),
            );
            if (existingBudget.length > 0) {
              await unlink(
                "altitud.budget.line",
                existingBudget.map((line) => line.id),
              );
            }
          }
        }
        await confirmOrder(id);
        await postNote(
          "project.project",
          quote.project_id,
          `El cliente autorizó ${quote.folio} por ${quote.amount_total.toFixed(2)}. El proyecto queda con presupuesto base y precio de venta.`,
          session,
        );
        return json({
          quote: await readQuote(id),
          project_id: quote.project_id,
          project_folio: quote.project_folio ?? "",
        });
      }

      // Caso B: prospecto nuevo → se abre el proyecto con su presupuesto.
      // El estatus se escribe hasta el final: mientras no haya proyecto, la
      // cotización sigue siendo autorizable.
      const projectId = await createProjectRecord({
        name: quote.name,
        clientId: quote.client_id ?? 0,
        site: str(payload.site),
        area: quote.area,
        company: quote.company,
        supervisorId: num(payload.supervisor_id, 0) || undefined,
        coordinatorId: num(payload.coordinator_id, 0) || session.uid,
        startDate: str(payload.start_date) ?? dayIso(1),
        contractAmount: quote.amount_total,
        quoteFolio: quote.folio,
        stage: "autorizado",
        notes: `Generado al autorizar ${quote.folio}. Jornales estimados: ${quote.jornales_total}.`,
        budget: budgetSeedFromCost(quote.area, quote.cost_total),
      });

      await write("sale.order", [id], { project_id: projectId, x_status: "autorizada" });
      await logStep(id, "autorizada", user, str(payload.comment));
      await confirmOrder(id);

      const project = await searchRead<{ id: number; x_folio: string | false }>(
        "project.project",
        [["id", "=", projectId]],
        { fields: ["id", "x_folio"] },
      );
      const folio = project[0]?.x_folio || "";
      await postNote(
        "project.project",
        projectId,
        `Proyecto ${folio} abierto al autorizar la cotización ${quote.folio}.`,
        session,
      );

      return json({
        quote: await readQuote(id),
        project_id: projectId,
        project_folio: folio,
      });
    }

    /**
     * Generar una cotización DESDE el proyecto. [R-06] [R-09] [R-14]
     *
     *  - `levantamiento`: el trabajo nuevo; se arma al analizar el sitio.
     *  - `extras`:        extras cobrables de una obra en marcha.
     *  - `adicional`:     trabajo nuevo del cliente en el mismo sitio.
     */
    case "createFromProject": {
      const projectId = num(payload.project_id);
      const projects = await searchRead<{
        id: number;
        name: string;
        x_folio: string | false;
        partner_id: Many2One;
        company_id: Many2One;
        x_area: ProjectArea | false;
        x_contract_amount: number;
        x_coordinator_id: Many2One;
        x_survey_done_by: string | false;
        x_survey_date: string | false;
        x_survey_notes: string | false;
        x_survey_measurements: string | false;
      }>("project.project", [["id", "=", projectId]], {
        fields: [
          "id",
          "name",
          "x_folio",
          "partner_id",
          "company_id",
          "x_area",
          "x_contract_amount",
          "x_coordinator_id",
          "x_survey_done_by",
          "x_survey_date",
          "x_survey_notes",
          "x_survey_measurements",
        ],
      });
      if (projects.length === 0) return notFound("El proyecto no existe.");
      const project = projects[0];
      const area = (project.x_area || "limpieza") as ProjectArea;

      const origin = (str(payload.origin) ?? "levantamiento") as QuoteOrigin;
      const freeProduct = await getFreeServiceProduct();
      let lines: LineInput[] = [];
      let notes = str(payload.notes);
      let extrasToMark: number[] = [];

      if (origin === "extras") {
        const pending = await searchRead<{
          id: number;
          concept: string;
          category: CostCategory;
          amount: number;
        }>(
          "altitud.extra",
          [
            ["project_id", "=", projectId],
            ["kind", "=", "extra"],
            ["billable", "=", true],
            ["quote_folio", "=", false],
          ],
          { fields: ["id", "concept", "category", "amount"] },
        );

        const ids = Array.isArray(payload.extra_ids)
          ? (payload.extra_ids as unknown[]).map((value) => num(value))
          : null;
        const selected = ids ? pending.filter((extra) => ids.includes(extra.id)) : pending;
        if (selected.length === 0) {
          return badRequest("No hay extras cobrables pendientes de cotizar en este proyecto.");
        }

        extrasToMark = selected.map((extra) => extra.id);
        lines = selected.map((extra) => ({
          productId: freeProduct,
          name: `${extra.concept} (${CATEGORY_LABELS[extra.category]})`,
          qty: 1,
          priceUnit: extra.amount,
          // El costo del extra ya está dentro del gasto real del proyecto.
          costUnit: round2(extra.amount * 0.7),
          jornales: 0,
        }));
        notes = notes ?? `Extras de obra del proyecto ${project.x_folio}.`;
      } else if (origin === "inicial") {
        const amount = num(payload.amount, project.x_contract_amount);
        if (amount <= 0) return badRequest("Captura el importe a cotizar.");
        lines = [
          {
            productId: freeProduct,
            name: str(payload.concept) ?? project.name,
            qty: 1,
            priceUnit: amount,
            costUnit: round2(amount * 0.7),
            jornales: 0,
          },
        ];
        notes = notes ?? `Formalización de ${project.x_folio}, que se abrió sin cotización.`;
      } else {
        lines = await buildLines(
          Array.isArray(payload.lines) ? (payload.lines as Payload[]) : [],
        );
        if (origin !== "levantamiento" && lines.length === 0) {
          return badRequest("Agrega al menos una partida a cotizar.");
        }
        notes =
          notes ??
          (origin === "levantamiento"
            ? `Cotización armada desde el levantamiento ${project.x_folio}.`
            : `Trabajo adicional solicitado en ${project.x_folio}.`);
      }

      const owner =
        str(payload.owner) ?? m2oName(project.x_coordinator_id) ?? session.name;
      const overhead = num(payload.overhead_pct, 22);
      const name =
        str(payload.name) ??
        (origin === "extras"
          ? `Extras de obra · ${project.name}`
          : origin === "adicional"
            ? `Trabajo adicional · ${project.name}`
            : project.name);

      const orderId = await create("sale.order", {
        name: await nextQuoteFolio(),
        x_title: name,
        partner_id: m2oId(project.partner_id) ?? false,
        company_id: m2oId(project.company_id) ?? (await companyIdOf("altitude")),
        x_area: area,
        // Nace en cálculo: ya hay números, falta el visto bueno. [R-13]
        x_status: "calculo",
        validity_date: dayIso(15),
        x_owner: owner,
        x_overhead_pct: overhead,
        x_origin: origin,
        x_notes: notes ?? false,
        project_id: projectId,
      });
      await write("sale.order", [orderId], { x_folio: await folioOf(orderId) });

      await writeLines(orderId, lines);
      await recalcTotals(orderId, overhead);
      await logStep(orderId, "calculo", owner);

      if (origin === "levantamiento") {
        await write("sale.order", [orderId], {
          x_survey_done_by: project.x_survey_done_by || owner,
          x_survey_date: project.x_survey_date || dayIso(0),
          x_survey_notes: project.x_survey_notes || false,
          x_survey_measurements: project.x_survey_measurements || false,
        });
        const surveyPhotos = await searchRead<{
          id: number;
          name: string;
          datas: string | false;
          mimetype: string | false;
          description: string | false;
        }>(
          "ir.attachment",
          [
            ["res_model", "=", "project.project"],
            ["res_id", "=", projectId],
          ],
          { fields: ["id", "name", "datas", "mimetype", "description"] },
        );
        for (const photo of surveyPhotos) {
          let meta: { kind?: string } = {};
          try {
            meta = photo.description ? (JSON.parse(photo.description) as { kind?: string }) : {};
          } catch {
            meta = {};
          }
          if (meta.kind !== "survey" || !photo.datas) continue;
          await create("ir.attachment", {
            name: photo.name,
            res_model: "sale.order",
            res_id: orderId,
            datas: photo.datas,
            mimetype: photo.mimetype || "image/jpeg",
            description: photo.description || false,
          });
        }
        const cotizado = await stageIdOf("cotizado");
        if (cotizado) {
          await write("project.project", [projectId], { stage_id: cotizado });
        }
      }

      const quote = await readQuote(orderId);

      // Marca los extras ya cotizados para no cobrarlos dos veces. [R-06]
      if (extrasToMark.length > 0 && quote) {
        await write("altitud.extra", extrasToMark, { quote_folio: quote.folio });
      }

      await postNote(
        "project.project",
        projectId,
        `Se generó la cotización ${quote?.folio ?? ""} para el cliente (${
          origin === "extras"
            ? "extras de obra"
            : origin === "adicional"
              ? "trabajo adicional"
              : origin === "levantamiento"
                ? "desde el levantamiento"
                : "cotización inicial"
        }) por ${(quote?.amount_total ?? 0).toFixed(2)}.`,
        session,
      );

      return json(quote);
    }

    /** Extras cobrables que todavía no se le han cotizado al cliente. [R-06] */
    case "pendingExtras": {
      const projectId = num(payload.project_id);
      const rows = await searchRead<{
        id: number;
        concept: string;
        category: CostCategory;
        amount: number;
        date: string;
      }>(
        "altitud.extra",
        [
          ["project_id", "=", projectId],
          ["kind", "=", "extra"],
          ["billable", "=", true],
          ["quote_folio", "=", false],
        ],
        { fields: ["id", "concept", "category", "amount", "date"], order: "date desc" },
      );

      return json({
        rows: rows.map((extra) => ({
          id: extra.id,
          concept: extra.concept,
          category: extra.category,
          amount: round2(extra.amount),
          date: extra.date,
        })),
      });
    }

    case "reject": {
      const id = num(payload.id);
      const quote = await readQuote(id);
      if (!quote) return notFound("La cotización no existe.");

      await write("sale.order", [id], { x_status: "no_autorizada" });
      await logStep(id, "no_autorizada", str(payload.user) ?? session.name, str(payload.comment));
      try {
        await callKw("sale.order", "action_cancel", [[id]]);
      } catch {
        // Si el pedido no se puede cancelar en Odoo, el estatus de Altitud ya
        // quedó: es el que manda en la pantalla.
      }
      return json(await readQuote(id));
    }

    default:
      return unknownAction(action);
  }
}

/** Confirmar el pedido es lo que lo convierte en orden de venta. */
async function confirmOrder(orderId: number): Promise<void> {
  try {
    await callKw("sale.order", "action_confirm", [[orderId]]);
  } catch (error) {
    // Autorizar no se cae porque Odoo no pueda confirmar: el estatus de
    // Altitud y el proyecto ya quedaron bien. Queda el aviso en el log.
    console.warn("[cotizaciones] no se pudo confirmar el pedido", orderId, error);
  }
}

async function nextQuoteFolio(): Promise<string> {
  const value = await callKw<string | false>("ir.sequence", "next_by_code", ["altitud.quote"]);
  return value || `COT-${Date.now()}`;
}

async function folioOf(orderId: number): Promise<string> {
  const rows = await searchRead<{ id: number; name: string }>(
    "sale.order",
    [["id", "=", orderId]],
    { fields: ["id", "name"] },
  );
  return rows[0]?.name ?? "";
}
