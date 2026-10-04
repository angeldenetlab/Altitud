import type { Employee, ProjectArea, ServiceItem } from "@/types/altitude";
import { AREA_LABELS, COMPANY_LABELS } from "@/lib/labels";
import { contains, num, round2, search, str, sum } from "@/lib/compute";
import { badRequest, json, notFound, type Payload, unknownAction } from "@/lib/http";
import type { SessionPayload } from "@/lib/auth/server-session";
import {
  type Domain,
  type Many2One,
  create,
  m2oId,
  m2oName,
  searchRead,
  write,
} from "@/lib/odoo/client";
import {
  PROJECT_DOMAIN,
  companyCodeOf,
  companyIdOf,
  getCompanies,
} from "@/server/erp/common";

/**
 * Catálogos: servicios con paramétricos, personal, razones sociales y accesos.
 * [R-10] [R-16] [R-33] [R-37]
 *
 * Son los cuatro padrones de los que leen cotizaciones, cuadrillas y
 * prenómina. Nada de esto es un modelo nuevo: el servicio es
 * `product.template` de tipo servicio, el colaborador es `hr.employee`, la
 * razón social es `res.company` y el acceso es `res.users`.
 *
 * Servicios y personal se leen con `active_test: false` porque la pantalla
 * muestra y alterna las bajas; el filtro de alta lo decide el front.
 */

const NO_ACTIVE_TEST = { active_test: false } as const;

// ---------------------------------------------------------------------------
// Servicios → product.template
// ---------------------------------------------------------------------------

/** El catálogo de Altitud es solo lo que tiene área: lo demás es producto
 *  nativo de Odoo y no se cotiza por paramétrico. [R-10] */
const SERVICE_DOMAIN: Domain = [
  ["type", "=", "service"],
  ["x_area", "!=", false],
];

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
];

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
}

function toService(row: OdooService): ServiceItem {
  return {
    id: row.id,
    code: row.default_code || `SRV-${row.id}`,
    name: row.name,
    area: (row.x_area || "limpieza") as ProjectArea,
    unit: m2oName(row.uom_id) ?? "servicio",
    price_unit: round2(row.list_price || 0),
    cost_unit: round2(row.standard_price || 0),
    // Sin rendimiento no hay jornales: 1 es el neutro de la división. [R-12]
    yield_per_jornal: row.x_yield_per_jornal || 1,
    active: row.active,
  };
}

async function readService(id: number): Promise<OdooService | undefined> {
  const rows = await searchRead<OdooService>("product.template", [["id", "=", id]], {
    fields: SERVICE_FIELDS,
    context: NO_ACTIVE_TEST,
  });
  return rows[0];
}

/**
 * La unidad es texto libre en la pantalla y many2one en Odoo.
 *
 * Se busca por nombre exacto sin distinguir mayúsculas. Si no existe, no se
 * inventa una unidad de medida nueva: se deja la que ya tiene el producto y
 * la respuesta devuelve igual el texto que capturó el usuario.
 */
async function resolveUomId(unit: string): Promise<number | undefined> {
  const rows = await searchRead<{ id: number }>("uom.uom", [["name", "=ilike", unit]], {
    fields: ["id"],
    limit: 1,
    context: NO_ACTIVE_TEST,
  });
  return rows[0]?.id;
}

// ---------------------------------------------------------------------------
// Personal → hr.employee
// ---------------------------------------------------------------------------

const EMPLOYEE_FIELDS = [
  "id",
  "name",
  "job_title",
  "x_area",
  "x_jornal",
  "work_phone",
  "company_id",
  "active",
];

interface OdooEmployee {
  id: number;
  name: string;
  job_title: string | false;
  x_area: Employee["area"] | false;
  x_jornal: number;
  work_phone: string | false;
  company_id: Many2One;
  active: boolean;
}

async function toEmployee(row: OdooEmployee): Promise<Employee> {
  return {
    id: row.id,
    name: row.name,
    job: row.job_title || "Ayudante general",
    area: (row.x_area || "mixto") as Employee["area"],
    jornal: round2(row.x_jornal || 0),
    phone: row.work_phone || undefined,
    company: await companyCodeOf(m2oId(row.company_id)),
    active: row.active,
  };
}

async function readEmployee(id: number): Promise<OdooEmployee | undefined> {
  const rows = await searchRead<OdooEmployee>("hr.employee", [["id", "=", id]], {
    fields: EMPLOYEE_FIELDS,
    context: NO_ACTIVE_TEST,
  });
  return rows[0];
}

// ---------------------------------------------------------------------------
// Despachador
// ---------------------------------------------------------------------------

export async function handleCatalogs(action: string, payload: Payload, session: SessionPayload) {
  void session; // Los catálogos no llevan bitácora: el rastro lo deja Odoo.

  switch (action) {
    /** Servicios con precio y rendimiento paramétrico. [R-10] [R-16] */
    case "services": {
      const term = search(payload.search);
      const area = str(payload.area);

      const domain: Domain = [...SERVICE_DOMAIN];
      if (area && area !== "todas") domain.push(["x_area", "=", area]);

      const raw = await searchRead<OdooService>("product.template", domain, {
        fields: SERVICE_FIELDS,
        order: "default_code, name",
        context: NO_ACTIVE_TEST,
      });

      const rows = raw
        .map(toService)
        .filter((service) => contains(term, service.name, service.code));

      return json({ rows, total: rows.length });
    }

    /** Alta o edición de un paramétrico. [R-10] */
    case "saveService": {
      const id = num(payload.id, 0);
      const name = str(payload.name);
      const code = str(payload.code);
      if (!name || !code) return badRequest("El código y el nombre del servicio son obligatorios.");

      const existing = id ? await readService(id) : undefined;
      const requestedUnit = str(payload.unit);

      const values: Record<string, unknown> = {
        name,
        default_code: code,
        x_area: (str(payload.area) ?? "limpieza") as ProjectArea,
        list_price: round2(num(payload.price_unit, 0)),
        standard_price: round2(num(payload.cost_unit, 0)),
        // Sin rendimiento mínimo los jornales de la cotización se irían a
        // infinito al dividir entre cero. [R-12]
        x_yield_per_jornal: Math.max(0.1, num(payload.yield_per_jornal, 1)),
        active: payload.active !== false,
      };

      if (requestedUnit) {
        const uomId = await resolveUomId(requestedUnit);
        if (uomId) {
          // La unidad de compra va junto con la de venta: Odoo exige que
          // ambas sean de la misma categoría.
          values.uom_id = uomId;
          values.uom_po_id = uomId;
        }
      }

      let serviceId = id;
      if (existing) {
        await write("product.template", [existing.id], values);
      } else {
        serviceId = await create("product.template", {
          ...values,
          // Es un servicio que se vende, no un artículo que se compra. [R-16]
          type: "service",
          sale_ok: true,
          purchase_ok: false,
        });
      }

      const saved = await readService(serviceId);
      if (!saved) return notFound("El servicio no existe.");

      const service = toService(saved);
      // Si la unidad capturada no está en `uom.uom` igual se devuelve tal
      // cual: la pantalla la trata como texto.
      return json({ ...service, unit: requestedUnit ?? service.unit });
    }

    /** Padrón de colaboradores con su jornal. [R-20] */
    case "employees": {
      const term = search(payload.search);
      const area = str(payload.area);

      const domain: Domain = [];
      if (area && area !== "todas") domain.push(["x_area", "=", area]);

      const raw = await searchRead<OdooEmployee>("hr.employee", domain, {
        fields: EMPLOYEE_FIELDS,
        order: "name",
        context: NO_ACTIVE_TEST,
      });

      const mapped = await Promise.all(raw.map(toEmployee));
      const rows = mapped.filter((employee) => contains(term, employee.name, employee.job));

      return json({
        rows,
        total: rows.length,
        active: rows.filter((row) => row.active).length,
        jornal_avg: rows.length ? round2(sum(rows.map((row) => row.jornal)) / rows.length) : 0,
      });
    }

    /**
     * El jornal individual es la base del costo de mano de obra. [R-20]
     *
     * Solo se escribe `x_jornal`: el addon deriva de ahí el `hourly_cost` con
     * el que Odoo costea la parte de horas. Escribirlo a mano lo desalinea.
     */
    case "saveEmployee": {
      const id = num(payload.id, 0);
      const name = str(payload.name);
      if (!name) return badRequest("El nombre del colaborador es obligatorio.");

      const existing = id ? await readEmployee(id) : undefined;

      if (existing) {
        const values: Record<string, unknown> = { name };
        if (str(payload.job)) values.job_title = str(payload.job);
        if (str(payload.area)) values.x_area = str(payload.area);
        if (payload.jornal !== undefined) values.x_jornal = round2(num(payload.jornal, existing.x_jornal));
        if (payload.phone !== undefined) values.work_phone = str(payload.phone) ?? false;
        if (str(payload.company)) values.company_id = await companyIdOf(str(payload.company));
        if (payload.active !== undefined) values.active = payload.active !== false;

        await write("hr.employee", [existing.id], values);
        const updated = (await readEmployee(existing.id)) ?? existing;
        return json(await toEmployee(updated));
      }

      const employeeId = await create("hr.employee", {
        name,
        job_title: str(payload.job) ?? "Ayudante general",
        x_area: str(payload.area) ?? "mixto",
        x_jornal: round2(num(payload.jornal, 460)),
        work_phone: str(payload.phone) ?? false,
        // El personal de campo nómina en la operadora. [R-37]
        company_id: await companyIdOf(str(payload.company) ?? "servicios"),
        // El alta siempre nace activa; la baja es `toggleEmployee`.
        active: true,
      });

      const created = await readEmployee(employeeId);
      if (!created) return notFound("El colaborador no existe.");
      return json(await toEmployee(created));
    }

    /** Alta y baja del colaborador: es el `active` de `hr.employee`. */
    case "toggleEmployee": {
      const id = num(payload.id);
      const employee = await readEmployee(id);
      if (!employee) return notFound("El colaborador no existe.");

      await write("hr.employee", [id], { active: !employee.active });
      const updated = (await readEmployee(id)) ?? { ...employee, active: !employee.active };
      return json(await toEmployee(updated));
    }

    /** Razones sociales sobre las que se opera. [R-37] */
    case "companies": {
      const [companies, projects] = await Promise.all([
        getCompanies(),
        searchRead<{ id: number; company_id: Many2One }>("project.project", PROJECT_DOMAIN, {
          fields: ["id", "company_id"],
        }),
      ]);

      // Se cuenta en memoria: una consulta por compañía no aporta nada.
      const countByCompany = new Map<number, number>();
      projects.forEach((project) => {
        const companyId = m2oId(project.company_id) ?? 0;
        countByCompany.set(companyId, (countByCompany.get(companyId) ?? 0) + 1);
      });

      return json({
        rows: companies.rows.map((company) => ({
          code: company.code,
          name: company.name,
          rfc: company.rfc,
          label: COMPANY_LABELS[company.code],
          projects: countByCompany.get(company.id) ?? 0,
        })),
      });
    }

    /** Usuarios y roles. [R-33] */
    case "users": {
      const rows = await searchRead<{ id: number; name: string; x_app_role: string | false }>(
        "res.users",
        [["share", "=", false]],
        { fields: ["id", "name", "x_app_role"], order: "name" },
      );
      return json({
        rows: rows.map((row) => ({
          id: row.id,
          name: row.name,
          // Sin rol asignado se asume el de operación diaria.
          role: row.x_app_role || "control",
        })),
      });
    }

    /** Las áreas no son un modelo: se agregan proyectos y servicios por
     *  `x_area`. [R-02] */
    case "areas": {
      const [projects, services] = await Promise.all([
        searchRead<{ id: number; x_area: ProjectArea | false }>(
          "project.project",
          PROJECT_DOMAIN,
          { fields: ["id", "x_area"] },
        ),
        searchRead<{ id: number; x_area: ProjectArea | false }>(
          "product.template",
          SERVICE_DOMAIN,
          { fields: ["id", "x_area"], context: NO_ACTIVE_TEST },
        ),
      ]);

      return json({
        rows: (Object.keys(AREA_LABELS) as ProjectArea[]).map((area) => ({
          area,
          label: AREA_LABELS[area],
          projects: projects.filter((project) => project.x_area === area).length,
          services: services.filter((service) => service.x_area === area).length,
        })),
      });
    }

    case "activityTypes": {
      const rows = await searchRead<{ id: number; name: string }>("mail.activity.type", [], {
        fields: ["id", "name"],
        order: "sequence, id",
      });
      return json({ rows });
    }

    default:
      return unknownAction(action);
  }
}
