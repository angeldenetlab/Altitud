import type {
  CompanyCode,
  CostCategory,
  FieldExpense,
  Purchase,
  Supply,
} from "@/types/altitude";
import { contains, dayIso, num, round2, search, str, sum } from "@/lib/compute";
import { badRequest, json, notFound, type Payload, unknownAction } from "@/lib/http";
import type { SessionPayload } from "@/lib/auth/server-session";
import {
  type Domain,
  type Many2One,
  callKw,
  create,
  m2oId,
  m2oName,
  searchRead,
  unlink,
  write,
} from "@/lib/odoo/client";
import { companyIdOf, getCompanies } from "@/server/erp/common";
import { nextSequence } from "@/server/erp/projects";

/**
 * Compras, insumos y gastos de campo. [R-23] … [R-25] [R-27] [R-35]
 *
 * La compra es un `purchase.order` con el proyecto y la partida en campos
 * propios, y la cuenta analítica del proyecto en la línea.
 *
 * El XML y el pago del proveedor se siguen conciliando en CONTPAQi: aquí solo
 * se guarda folio y UUID de referencia, y el estatus de pago en
 * `x_pago_status`, porque la contabilidad no vive en Odoo. [R-35]
 */

// ---------------------------------------------------------------------------
// Lectura de compras
// ---------------------------------------------------------------------------

/** Solo las compras cargadas a un proyecto son del módulo; una cancelada ya
 *  no es gasto y no debe aparecer en el resumen. */
const PURCHASE_DOMAIN: Domain = [
  ["x_project_id", "!=", false],
  ["state", "!=", "cancel"],
];

const PURCHASE_FIELDS = [
  "id",
  "name",
  "x_folio",
  "date_order",
  "partner_id",
  "x_project_id",
  "x_partida",
  "x_concept",
  "amount_untaxed",
  "company_id",
  "x_invoice_folio",
  "x_invoice_uuid",
  "x_pago_status",
  "x_requested_by",
];

interface OdooPurchaseOrder {
  id: number;
  name: string;
  x_folio: string | false;
  date_order: string;
  partner_id: Many2One;
  x_project_id: Many2One;
  x_partida: CostCategory | false;
  x_concept: string | false;
  amount_untaxed: number;
  company_id: Many2One;
  x_invoice_folio: string | false;
  x_invoice_uuid: string | false;
  x_pago_status: Purchase["status"] | false;
  x_requested_by: string | false;
}

/**
 * Arma las filas del contrato a partir de los pedidos de compra.
 *
 * El folio del proyecto se resuelve en un solo `search_read` para toda la
 * lista: de otro modo serían tantas consultas como compras.
 */
async function toPurchases(orders: OdooPurchaseOrder[]): Promise<Purchase[]> {
  if (orders.length === 0) return [];

  const projectIds = Array.from(
    new Set(orders.map((order) => m2oId(order.x_project_id) ?? 0).filter(Boolean)),
  );
  const [projects, companies] = await Promise.all([
    projectIds.length
      ? searchRead<{ id: number; x_folio: string | false }>(
          "project.project",
          [["id", "in", projectIds]],
          { fields: ["id", "x_folio"] },
        )
      : Promise.resolve([]),
    getCompanies(),
  ]);
  const folioByProject = new Map(projects.map((row) => [row.id, row.x_folio || ""]));

  return orders.map((order): Purchase => {
    const projectId = m2oId(order.x_project_id) ?? 0;
    return {
      id: order.id,
      folio: order.x_folio || order.name,
      date: order.date_order.slice(0, 10),
      supplier: m2oName(order.partner_id) ?? "Proveedor",
      project_id: projectId,
      project_folio: folioByProject.get(projectId) ?? "",
      category: (order.x_partida || "materiales") as CostCategory,
      concept: order.x_concept || order.name,
      amount: round2(order.amount_untaxed || 0),
      company: (companies.byId.get(m2oId(order.company_id) ?? 0) ?? "altitude") as CompanyCode,
      invoice_folio: order.x_invoice_folio || undefined,
      invoice_uuid: order.x_invoice_uuid || undefined,
      status: order.x_pago_status || "sin_factura",
      requested_by: order.x_requested_by || "Usuario",
    };
  });
}

async function loadPurchase(id: number): Promise<Purchase | null> {
  const orders = await searchRead<OdooPurchaseOrder>("purchase.order", [["id", "=", id]], {
    fields: PURCHASE_FIELDS,
  });
  if (orders.length === 0) return null;
  const [row] = await toPurchases(orders);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Alta de la compra
// ---------------------------------------------------------------------------

/**
 * Producto de servicio con el que se carga cualquier compra.
 *
 * Tiene que ser servicio: `purchase_stock` está instalado y confirmar un
 * pedido con producto almacenable generaría una recepción de almacén, y aquí
 * no se lleva almacén. [R-25]
 *
 * Se resuelve una vez por proceso.
 */
let purchaseProductCache: Promise<number> | null = null;

const PURCHASE_PRODUCT_CODE = "ALT-COMPRA";

async function getPurchaseProductId(): Promise<number> {
  if (!purchaseProductCache) {
    purchaseProductCache = (async () => {
      const existing = await searchRead<{ id: number }>(
        "product.product",
        [["default_code", "=", PURCHASE_PRODUCT_CODE]],
        { fields: ["id"], limit: 1 },
      );
      if (existing.length > 0) return existing[0].id;
      return create("product.product", {
        name: "Compra cargada a proyecto",
        default_code: PURCHASE_PRODUCT_CODE,
        type: "service",
        purchase_ok: true,
        sale_ok: false,
      });
    })().catch((error: unknown) => {
      purchaseProductCache = null;
      throw error;
    });
  }
  return purchaseProductCache;
}

/**
 * El proveedor llega como texto libre desde la pantalla de alta.
 *
 * Si ya existe el contacto se reutiliza (y se marca como proveedor si venía
 * solo como cliente); si no, se da de alta. Así el catálogo de `suppliers`
 * se va armando solo con lo que de verdad se compra.
 */
async function resolveSupplier(name: string): Promise<number> {
  const asSupplier = await searchRead<{ id: number }>(
    "res.partner",
    [
      ["supplier_rank", ">", 0],
      ["name", "=ilike", name],
    ],
    { fields: ["id"], limit: 1 },
  );
  if (asSupplier.length > 0) return asSupplier[0].id;

  const anyPartner = await searchRead<{ id: number }>(
    "res.partner",
    [["name", "=ilike", name]],
    { fields: ["id"], limit: 1 },
  );
  if (anyPartner.length > 0) {
    await write("res.partner", [anyPartner[0].id], { supplier_rank: 1 });
    return anyPartner[0].id;
  }

  return create("res.partner", { name, supplier_rank: 1, company_type: "company" });
}

interface ProjectForPurchase {
  id: number;
  folio: string;
  accountId?: number;
  companyId?: number;
}

async function projectForPurchase(id: number): Promise<ProjectForPurchase | null> {
  if (!id) return null;
  const rows = await searchRead<{
    id: number;
    x_folio: string | false;
    account_id: Many2One;
    company_id: Many2One;
  }>("project.project", [["id", "=", id]], {
    fields: ["id", "x_folio", "account_id", "company_id"],
  });
  if (rows.length === 0) return null;
  return {
    id: rows[0].id,
    folio: rows[0].x_folio || "",
    accountId: m2oId(rows[0].account_id),
    companyId: m2oId(rows[0].company_id),
  };
}

// ---------------------------------------------------------------------------
// Insumos y gastos de campo
// ---------------------------------------------------------------------------

interface OdooSupply {
  id: number;
  code: string | false;
  name: string;
  unit: string | false;
  on_hand: number;
  reorder_point: number;
  last_count: string | false;
}

const SUPPLY_FIELDS = ["id", "code", "name", "unit", "on_hand", "reorder_point", "last_count"];

function toSupply(row: OdooSupply): Supply {
  return {
    id: row.id,
    code: row.code || `INS-${row.id}`,
    name: row.name,
    unit: row.unit || "pieza",
    on_hand: round2(row.on_hand || 0),
    reorder_point: round2(row.reorder_point || 0),
    last_count: row.last_count || "",
  };
}

/** El gasto de campo no es un modelo aparte: es la línea analítica que
 *  escribe `addFieldExpense` de proyectos. [R-27] */
const FIELD_EXPENSE_DOMAIN: Domain = [["x_source", "=", "gasto_campo"]];

interface OdooFieldExpense {
  id: number;
  name: string;
  date: string;
  amount: number;
  ref: string | false;
  x_project_id: Many2One;
  x_partida: CostCategory | false;
  x_captured_by: string | false;
  x_has_receipt: boolean;
}

// ---------------------------------------------------------------------------
// Despachador
// ---------------------------------------------------------------------------

export async function handlePurchases(action: string, payload: Payload, session: SessionPayload) {
  switch (action) {
    /** Compras cargadas al proyecto, con su resumen. [R-23] */
    case "list": {
      const term = search(payload.search);
      const projectId = num(payload.project_id, 0);
      const status = str(payload.status);
      const category = str(payload.category);

      const domain: Domain = [...PURCHASE_DOMAIN];
      if (projectId) domain.push(["x_project_id", "=", projectId]);
      if (status && status !== "todas") domain.push(["x_pago_status", "=", status]);
      if (category && category !== "todas") domain.push(["x_partida", "=", category]);

      const orders = await searchRead<OdooPurchaseOrder>("purchase.order", domain, {
        fields: PURCHASE_FIELDS,
        order: "date_order desc, id desc",
      });

      let rows = await toPurchases(orders);
      if (term) {
        rows = rows.filter((row) =>
          contains(
            term,
            row.folio,
            row.supplier,
            row.concept,
            row.project_folio,
            row.invoice_folio,
          ),
        );
      }

      return json({
        rows,
        total: rows.length,
        amount: sum(rows.map((row) => row.amount)),
        // Sin factura se cuenta (cuántas faltan por documentar) y por pagar se
        // suma (cuánto debe la empresa): no son la misma pregunta.
        sin_factura: rows.filter((row) => row.status === "sin_factura").length,
        por_pagar: sum(rows.filter((row) => row.status === "por_pagar").map((row) => row.amount)),
      });
    }

    case "get":
      return json(await loadPurchase(num(payload.id)));

    /**
     * Registro de compra asignada directamente a un proyecto. [R-23] [R-24]
     *
     * El pedido se confirma en el acto: el gasto real de compras se lee de las
     * líneas confirmadas sin facturar (`qty_to_invoice × price_unit`), igual
     * que el reporte nativo de rentabilidad. Por eso **no** se escribe una
     * línea analítica a mano: se duplicaría el día que alguien contabilice la
     * factura del proveedor en Odoo.
     */
    case "create": {
      const project = await projectForPurchase(num(payload.project_id));
      if (!project) return badRequest("Selecciona el proyecto al que se carga la compra.");

      const amount = num(payload.amount, 0);
      if (amount <= 0) return badRequest("El importe debe ser mayor a cero.");

      const concept = str(payload.concept) ?? "Material";
      const date = str(payload.date) ?? dayIso(0);
      const invoiceFolio = str(payload.invoice_folio);

      const [productId, supplierId, folio, companyId] = await Promise.all([
        getPurchaseProductId(),
        resolveSupplier(str(payload.supplier) ?? "Proveedor"),
        nextSequence("altitud.purchase"),
        project.companyId
          ? Promise.resolve(project.companyId)
          : companyIdOf(session.company),
      ]);

      // Con la distribución analítica del proyecto, la rentabilidad nativa de
      // Odoo ve la compra sin que nadie la capture otra vez.
      const line: Record<string, unknown> = {
        product_id: productId,
        name: concept,
        product_qty: 1,
        price_unit: round2(amount),
      };
      if (project.accountId) {
        line.analytic_distribution = { [String(project.accountId)]: 100 };
      }

      const orderId = await create("purchase.order", {
        partner_id: supplierId,
        // `date_order` es datetime; el mediodía evita que el cambio de huso
        // mueva la compra al día anterior.
        date_order: `${date} 12:00:00`,
        company_id: companyId,
        x_folio: folio,
        x_project_id: project.id,
        x_partida: (str(payload.category) ?? "materiales") as CostCategory,
        x_concept: concept,
        x_invoice_folio: invoiceFolio ?? false,
        x_invoice_uuid: str(payload.invoice_uuid) ?? false,
        // Con factura del proveedor queda por pagar; sin ella, pendiente de
        // documentar. El pago se concilia en CONTPAQi. [R-35]
        x_pago_status: invoiceFolio ? "por_pagar" : "sin_factura",
        x_requested_by: str(payload.requested_by) ?? session.name,
        order_line: [[0, 0, line]],
      });

      /**
       * Confirmar es lo que vuelve la compra un costo del proyecto: en
       * borrador aparecería en la lista de compras pero no en el gasto, y las
       * dos pantallas dirían cosas distintas. Si Odoo no deja confirmarla
       * (un aviso del proveedor, por ejemplo), se deshace el pedido para no
       * dejar un folio a medias que el usuario va a duplicar al reintentar.
       */
      try {
        await callKw("purchase.order", "button_confirm", [[orderId]]);
      } catch (error) {
        try {
          await write("purchase.order", [orderId], { state: "cancel" });
          await unlink("purchase.order", [orderId]);
        } catch {
          // Si tampoco se puede borrar, queda cancelada: no suma al costo.
        }
        throw error;
      }

      const created = await loadPurchase(orderId);
      if (!created) return notFound("No se pudo leer la compra recién creada.");
      return json(created);
    }

    /** Cambiar el estatus de pago no vuelve a sumar el costo. [R-24] [R-35] */
    case "setStatus": {
      const id = num(payload.id);
      const purchase = await loadPurchase(id);
      if (!purchase) return notFound("La compra no existe.");

      const status = str(payload.status);
      if (!status || !["sin_factura", "por_pagar", "pagada"].includes(status)) {
        return badRequest("Estatus inválido.");
      }

      const values: Record<string, unknown> = { x_pago_status: status };
      if (str(payload.invoice_folio)) values.x_invoice_folio = str(payload.invoice_folio);
      if (str(payload.invoice_uuid)) values.x_invoice_uuid = str(payload.invoice_uuid);
      await write("purchase.order", [id], values);

      return json(await loadPurchase(id));
    }

    /** Conteo básico de insumos: solo para saber cuándo reponer. [R-25] */
    case "supplies": {
      const term = search(payload.search);
      const rows = (
        await searchRead<OdooSupply>("altitud.supply", [], {
          fields: SUPPLY_FIELDS,
          order: "code, name",
        })
      )
        .map(toSupply)
        .filter((supply) => contains(term, supply.name, supply.code));

      return json({
        rows,
        total: rows.length,
        to_reorder: rows.filter((row) => row.on_hand <= row.reorder_point).length,
      });
    }

    case "countSupply": {
      const id = num(payload.id);
      const rows = await searchRead<OdooSupply>("altitud.supply", [["id", "=", id]], {
        fields: SUPPLY_FIELDS,
      });
      if (rows.length === 0) return notFound("El insumo no existe.");

      const values: Record<string, unknown> = {
        on_hand: Math.max(0, num(payload.on_hand, rows[0].on_hand)),
        // El conteo deja constancia del día en que se contó.
        last_count: dayIso(0),
      };
      if (payload.reorder_point !== undefined) {
        values.reorder_point = Math.max(0, num(payload.reorder_point, rows[0].reorder_point));
      }
      await write("altitud.supply", [id], values);

      const updated = await searchRead<OdooSupply>("altitud.supply", [["id", "=", id]], {
        fields: SUPPLY_FIELDS,
      });
      return json(updated.length > 0 ? toSupply(updated[0]) : null);
    }

    /** Gastos capturados desde campo, para el tablero de administración. [R-27] */
    case "expenses": {
      const projectId = num(payload.project_id, 0);
      const domain: Domain = [...FIELD_EXPENSE_DOMAIN];
      if (projectId) domain.push(["x_project_id", "=", projectId]);

      const lines = await searchRead<OdooFieldExpense>("account.analytic.line", domain, {
        fields: [
          "id",
          "name",
          "date",
          "amount",
          "ref",
          "x_project_id",
          "x_partida",
          "x_captured_by",
          "x_has_receipt",
        ],
        order: "date desc, id desc",
      });

      const projectIds = Array.from(
        new Set(lines.map((line) => m2oId(line.x_project_id) ?? 0).filter(Boolean)),
      );
      const projects = projectIds.length
        ? await searchRead<{ id: number; x_folio: string | false }>(
            "project.project",
            [["id", "in", projectIds]],
            { fields: ["id", "x_folio"] },
          )
        : [];
      const folioByProject = new Map(projects.map((row) => [row.id, row.x_folio || ""]));

      const rows = lines.map((line): FieldExpense => {
        const id = m2oId(line.x_project_id) ?? 0;
        return {
          id: line.id,
          date: line.date,
          project_id: id,
          project_folio: folioByProject.get(id) ?? "",
          category: (line.x_partida || "gastos_operativos") as CostCategory,
          concept: line.name,
          // En la analítica el costo es negativo; el front lo muestra positivo.
          amount: round2(Math.abs(line.amount)),
          captured_by: line.x_captured_by || "Usuario",
          has_receipt: line.x_has_receipt === true,
        };
      });

      return json({ rows, total: rows.length, amount: sum(rows.map((row) => row.amount)) });
    }

    /** Catálogo de proveedores para el alta de compras. */
    case "suppliers": {
      const partners = await searchRead<{ id: number; name: string }>(
        "res.partner",
        [["supplier_rank", ">", 0]],
        { fields: ["id", "name"], order: "name" },
      );
      const names = Array.from(new Set(partners.map((row) => row.name).filter(Boolean)));
      return json({ rows: names.sort((a, b) => a.localeCompare(b, "es-MX")) });
    }

    default:
      return unknownAction(action);
  }
}
