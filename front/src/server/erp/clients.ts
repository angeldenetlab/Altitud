import type { Client, ClientDetail, ClientStats, QuoteStatus } from "@/types/altitude";
import { contains, isActiveStage, num, round2, search, str } from "@/lib/compute";
import { badRequest, json, notFound, type Payload, unknownAction } from "@/lib/http";
import type { SessionPayload } from "@/lib/auth/server-session";
import {
  type Domain,
  type Many2One,
  create,
  m2oId,
  searchRead,
  write,
} from "@/lib/odoo/client";
import {
  CLIENT_DOMAIN,
  CLIENT_FIELDS,
  type OdooPartner,
  companyIdOf,
  PROJECT_DOMAIN,
  getStages,
  loadProjects,
  toClientMany,
} from "@/server/erp/common";
import { postNote } from "@/server/erp/chatter";

/**
 * Catálogo de clientes. [R-09] [R-38]
 *
 * Un cliente es `res.partner` con `customer_rank > 0` y folio propio
 * (`x_folio`, que asigna la secuencia del addon al crear). Los prospectos y
 * los clientes viven en el mismo directorio: lo que los separa es la
 * actividad, no el modelo.
 *
 * El partner inactivo sigue siendo visible: la pantalla tiene su propio
 * filtro de altas y bajas, así que casi todas las lecturas van con
 * `active_test: false` y el filtro se decide aquí, no en Odoo.
 */

const NO_ACTIVE_TEST = { active_test: false } as const;

// ---------------------------------------------------------------------------
// Cotizaciones del cliente
// ---------------------------------------------------------------------------

interface OdooQuote {
  id: number;
  name: string;
  x_folio: string | false;
  x_status: QuoteStatus | false;
  amount_untaxed: number;
  date_order: string;
  project_id: Many2One;
}

const QUOTE_FIELDS = [
  "id",
  "name",
  "x_folio",
  "x_status",
  "amount_untaxed",
  "date_order",
  "project_id",
];

/** Una orden es una cotización ya autorizada: no hay modelo aparte. [R-15] */
const ORDER_STATUS: QuoteStatus = "autorizada";

// ---------------------------------------------------------------------------
// Lecturas puntuales
// ---------------------------------------------------------------------------

async function readPartner(id: number): Promise<OdooPartner | undefined> {
  if (!id) return undefined;
  const rows = await searchRead<OdooPartner>(
    "res.partner",
    [...CLIENT_DOMAIN, ["id", "=", id]],
    { fields: CLIENT_FIELDS, context: NO_ACTIVE_TEST },
  );
  return rows[0];
}

/**
 * Dos clientes con el mismo nombre son el mismo cliente capturado dos veces:
 * el duplicado se corta en el alta, no después. `=ilike` sin comodines es
 * igualdad sin distinguir mayúsculas, que es justo lo que pide la pantalla.
 *
 * `%` y `_` sí son comodines de SQL y hay que escaparlos: sin eso, dar de
 * alta «100% Limpieza» empataría con cualquier cliente que empiece en «100»
 * y el alta se rechazaría como duplicada sin serlo.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

async function findDuplicate(
  name: string,
  excludeId?: number,
): Promise<{ id: number; name: string } | undefined> {
  const domain: Domain = [...CLIENT_DOMAIN, ["name", "=ilike", escapeLike(name)]];
  if (excludeId) domain.push(["id", "!=", excludeId]);
  const rows = await searchRead<{ id: number; name: string }>("res.partner", domain, {
    fields: ["id", "name"],
    limit: 1,
    context: NO_ACTIVE_TEST,
  });
  return rows[0];
}

/**
 * El nombre del contacto se guarda como contacto hijo del partner, que es
 * donde lo espera Odoo (`child_ids`). El contrato de red no lo devuelve:
 * `toClientMany` resuelve el contacto de todos los clientes en una consulta.
 */
async function saveContactChild(partnerId: number, contact: string): Promise<void> {
  const existing = await searchRead<{ id: number }>(
    "res.partner",
    [
      ["parent_id", "=", partnerId],
      ["type", "=", "contact"],
    ],
    { fields: ["id"], limit: 1, order: "id", context: NO_ACTIVE_TEST },
  );
  if (existing[0]) {
    await write("res.partner", [existing[0].id], { name: contact });
    return;
  }
  await create("res.partner", { name: contact, parent_id: partnerId, type: "contact" });
}

// ---------------------------------------------------------------------------
// Despachador
// ---------------------------------------------------------------------------

export async function handleClients(action: string, payload: Payload, session: SessionPayload) {
  switch (action) {
    /** Directorio de clientes con sus KPIs de encabezado. [R-38] */
    case "list": {
      const term = search(payload.search);
      const company = str(payload.company);
      const activeFilter = payload.active;

      const domain: Domain = [...CLIENT_DOMAIN];
      // «todos» y ausente son lo mismo: la lista trae altas y bajas.
      if (activeFilter === true) domain.push(["active", "=", true]);
      if (activeFilter === false) domain.push(["active", "=", false]);

      const partners = await searchRead<OdooPartner>("res.partner", domain, {
        fields: CLIENT_FIELDS,
        order: "name",
        context: NO_ACTIVE_TEST,
      });

      let rows = await toClientMany(partners);

      // La razón social se filtra ya mapeada: en Odoo el partner puede venir
      // sin compañía (compartido) y `toClient` lo resuelve como «altitude».
      if (company && company !== "todas") {
        rows = rows.filter((row) => row.company === company);
      }
      if (term) {
        rows = rows.filter((row) =>
          contains(term, row.folio, row.name, row.contact, row.email, row.phone, row.rfc),
        );
      }
      rows = rows.sort((a, b) => a.name.localeCompare(b.name, "es-MX"));

      const withProjects = await activeClientIds();

      return json({
        rows,
        total: rows.length,
        active: rows.filter((row) => row.active).length,
        with_active_projects: rows.filter((row) => withProjects.has(row.id)).length,
      });
    }

    /** Ficha: el partner más todo lo que cuelga de él. */
    case "get": {
      const id = num(payload.id);
      const partner = await readPartner(id);
      if (!partner) return notFound("Cliente no encontrado.");

      const [client] = await toClientMany([partner]);

      const [projectRows, quoteRows] = await Promise.all([
        loadProjects([["partner_id", "=", id]]),
        searchRead<OdooQuote>("sale.order", [["partner_id", "=", id]], {
          fields: QUOTE_FIELDS,
          order: "date_order desc, id desc",
        }),
      ]);

      // El folio del proyecto ligado sale de los proyectos del propio cliente;
      // si alguna cotización apunta a otro, se completa en una sola consulta.
      const folioByProject = new Map<number, string>();
      projectRows.forEach((project) => folioByProject.set(project.id, project.folio));
      const missing = [
        ...new Set(
          quoteRows
            .map((quote) => m2oId(quote.project_id))
            .filter((projectId): projectId is number => !!projectId && !folioByProject.has(projectId)),
        ),
      ];
      if (missing.length > 0) {
        const extra = await searchRead<{ id: number; x_folio: string | false }>(
          "project.project",
          [["id", "in", missing]],
          { fields: ["id", "x_folio"] },
        );
        extra.forEach((project) => folioByProject.set(project.id, project.x_folio || ""));
      }

      const projects = projectRows
        .map((project) => ({
          id: project.id,
          folio: project.folio,
          name: project.name,
          stage: project.stage,
          area: project.area,
          contract_amount: project.contract_amount,
        }))
        .sort((a, b) => (a.folio < b.folio ? 1 : -1));

      const quotes = quoteRows.map((quote) => ({
        id: quote.id,
        folio: quote.x_folio || `SO-${quote.id}`,
        name: quote.name,
        status: (quote.x_status || "calculo") as QuoteStatus,
        amount_total: round2(quote.amount_untaxed),
        date: quote.date_order.slice(0, 10),
      }));

      const orders = quoteRows
        .filter((quote) => quote.x_status === ORDER_STATUS)
        .map((quote) => {
          const projectId = m2oId(quote.project_id);
          return {
            id: quote.id,
            folio: quote.x_folio || `SO-${quote.id}`,
            name: quote.name,
            amount_total: round2(quote.amount_untaxed),
            date: quote.date_order.slice(0, 10),
            project_folio: (projectId && folioByProject.get(projectId)) || undefined,
          };
        });

      const stats: ClientStats = {
        projects_count: projects.length,
        quotes_count: quotes.length,
        orders_count: orders.length,
        active_projects: projects.filter((project) => isActiveStage(project.stage)).length,
      };

      const detail: ClientDetail = { ...client, stats, projects, quotes, orders };
      return json(detail);
    }

    case "create": {
      const name = str(payload.name);
      if (!name) return badRequest("El nombre del cliente es obligatorio.");

      const duplicate = await findDuplicate(name);
      if (duplicate) return badRequest(`Ya existe un cliente con el nombre "${duplicate.name}".`);

      // `customer_rank` es lo que lo vuelve cliente y lo que dispara la
      // secuencia del folio en el addon: sin él el partner nace sin folio.
      const id = await create("res.partner", {
        name,
        customer_rank: 1,
        company_id: await companyIdOf(str(payload.company)),
        email: str(payload.email) ?? false,
        phone: str(payload.phone) ?? false,
        vat: str(payload.rfc) ?? false,
        comment: str(payload.notes) ?? false,
        active: payload.active !== false,
      });

      const contact = str(payload.contact);
      if (contact) await saveContactChild(id, contact);

      const created = await readPartner(id);
      const client: Client = created
        ? (await toClientMany([created]))[0]
        : { id, folio: `CLI-${id}`, name, company: "altitude", active: true };

      await postNote(
        "res.partner",
        id,
        `Cliente ${client.folio} registrado en el catálogo.`,
        session,
      );
      return json(client);
    }

    case "update": {
      const id = num(payload.id);
      const partner = await readPartner(id);
      if (!partner) return notFound("Cliente no encontrado.");

      const values: Record<string, unknown> = {};

      const name = str(payload.name);
      if (name) {
        const duplicate = await findDuplicate(name, id);
        if (duplicate) return badRequest(`Ya existe un cliente con el nombre "${duplicate.name}".`);
        values.name = name;
      }
      // Solo se escribe lo que mandó la pantalla: un campo ausente no se toca.
      if (payload.email !== undefined) values.email = str(payload.email) ?? false;
      if (payload.phone !== undefined) values.phone = str(payload.phone) ?? false;
      if (payload.rfc !== undefined) values.vat = str(payload.rfc) ?? false;
      if (payload.notes !== undefined) values.comment = str(payload.notes) ?? false;
      if (payload.active !== undefined) values.active = Boolean(payload.active);
      if (payload.company !== undefined) {
        values.company_id = await companyIdOf(str(payload.company));
      }

      if (Object.keys(values).length > 0) await write("res.partner", [id], values);

      const contact = str(payload.contact);
      if (contact) await saveContactChild(id, contact);

      const updated = (await readPartner(id)) ?? partner;
      const [client] = await toClientMany([updated]);

      await postNote(
        "res.partner",
        id,
        `Datos del cliente ${client.folio} actualizados.`,
        session,
      );
      return json(client);
    }

    default:
      return unknownAction(action);
  }
}

/**
 * Clientes con al menos un proyecto en curso. [R-29]
 *
 * Se resuelve con una sola lectura de proyectos acotada a las etapas activas
 * y se cruza en memoria por `client_id`: una consulta por cliente dejaría la
 * lista en N+1.
 */
async function activeClientIds(): Promise<Set<number>> {
  const { rows: stages } = await getStages();
  const activeStageIds = stages.filter((stage) => isActiveStage(stage.code)).map((stage) => stage.id);
  if (activeStageIds.length === 0) return new Set<number>();

  // Solo hacen falta los clientes, no los proyectos armados: `loadProjects`
  // traería presupuesto, gasto, fases y adjuntos de cada uno para tirarlos.
  const projects = await searchRead<{ id: number; partner_id: Many2One }>(
    "project.project",
    [...PROJECT_DOMAIN, ["stage_id", "in", activeStageIds]],
    { fields: ["id", "partner_id"] },
  );

  const ids = new Set<number>();
  projects.forEach((project) => {
    const partnerId = m2oId(project.partner_id);
    if (partnerId) ids.add(partnerId);
  });
  return ids;
}
