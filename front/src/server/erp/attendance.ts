import type {
  Attendance,
  AttendanceKind,
  AttendanceSource,
  Employee,
  ProjectArea,
} from "@/types/altitude";
import { ATTENDANCE_FACTOR, ATTENDANCE_KIND_LABELS } from "@/lib/labels";
import { contains, dayIso, num, round2, search, str, sum } from "@/lib/compute";
import { badRequest, json, notFound, type Payload, unknownAction } from "@/lib/http";
import type { SessionPayload } from "@/lib/auth/server-session";
import {
  type Many2One,
  OdooError,
  create,
  m2oId,
  m2oName,
  searchRead,
  unlink,
  write,
} from "@/lib/odoo/client";
import { localDayOf, localTimeOf, utcRangeForDays } from "@/lib/odoo/dates";
import { companyCodeOf } from "@/server/erp/common";

/**
 * Asistencias y mano de obra. [R-17] … [R-22]
 *
 * La presencia es `hr.attendance`, el módulo nativo. Lo que la pantalla
 * captura es una jornada (completa, media o falta), no un reloj: el addon
 * `altitud_base` arma `check_in` / `check_out` y mantiene la parte de horas
 * que se convierte en el gasto de mano de obra del proyecto.
 *
 * Por eso aquí casi no hay lógica de costo: basta con escribir la asistencia
 * y Odoo mueve el costo con ella, se capture desde el front o desde Odoo.
 *
 * Dos reglas las aplica el modelo, no este despachador, para que valgan
 * siempre: la persona tiene que estar en la cuadrilla del proyecto, y no
 * puede tener dos jornadas el mismo día.
 */

const ATTENDANCE_FIELDS = [
  "id",
  "employee_id",
  "check_in",
  "x_project_id",
  "x_jornada",
  "x_source",
  "x_note",
  "x_registered_by",
];

interface OdooAttendance {
  id: number;
  employee_id: Many2One;
  check_in: string;
  x_project_id: Many2One;
  x_jornada: AttendanceKind | false;
  x_source: AttendanceSource | false;
  x_note: string | false;
  x_registered_by: string | false;
}

interface OdooEmployee {
  id: number;
  name: string;
  job_title: string | false;
  x_area: ProjectArea | "mixto" | false;
  x_jornal: number;
  work_phone: string | false;
  company_id: Many2One;
  active: boolean;
}

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

async function toEmployee(row: OdooEmployee): Promise<Employee> {
  return {
    id: row.id,
    name: row.name,
    job: row.job_title || "Colaborador",
    area: (row.x_area || "mixto") as Employee["area"],
    jornal: round2(row.x_jornal || 0),
    phone: row.work_phone || undefined,
    company: await companyCodeOf(m2oId(row.company_id)),
    active: row.active,
  };
}

/** Solo lo que capturó Altitud es una jornada; una checada de kiosco no. */
const JORNADA_DOMAIN: unknown[] = [["x_jornada", "!=", false]];

/** Lee asistencias de un rango de días locales. */
async function readAttendance(from: string, to: string, extra: unknown[] = []) {
  const [start, end] = utcRangeForDays(from, to);
  const rows = await searchRead<OdooAttendance>(
    "hr.attendance",
    [...JORNADA_DOMAIN, ["check_in", ">=", start], ["check_in", "<=", end], ...extra],
    { fields: ATTENDANCE_FIELDS, order: "check_in desc, id desc" },
  );
  return rows
    .map((row) => ({ row, day: localDayOf(row.check_in) }))
    .filter((entry) => entry.day >= from && entry.day <= to);
}

async function hydrate(
  entries: { row: OdooAttendance; day: string }[],
): Promise<Attendance[]> {
  if (entries.length === 0) return [];

  const employeeIds = [
    ...new Set(entries.map((entry) => m2oId(entry.row.employee_id) ?? 0).filter(Boolean)),
  ];
  const projectIds = [
    ...new Set(entries.map((entry) => m2oId(entry.row.x_project_id) ?? 0).filter(Boolean)),
  ];

  const attendanceIds = entries.map((entry) => entry.row.id);

  const [employees, projects, costLines] = await Promise.all([
    employeeIds.length
      ? searchRead<{ id: number; name: string; x_jornal: number }>(
          "hr.employee",
          [["id", "in", employeeIds]],
          { fields: ["id", "name", "x_jornal"], context: { active_test: false } },
        )
      : Promise.resolve([]),
    projectIds.length
      ? searchRead<{ id: number; x_folio: string | false }>(
          "project.project",
          [["id", "in", projectIds]],
          { fields: ["id", "x_folio"] },
        )
      : Promise.resolve([]),
    // El costo de la jornada es el que quedó congelado en su parte de horas.
    // Recalcularlo con el jornal de hoy haría que una jornada de hace dos
    // meses cambiara de importe en cuanto alguien recibe un aumento, y la
    // lista de asistencias diría un número y la ficha del proyecto otro.
    attendanceIds.length
      ? searchRead<{ id: number; amount: number; x_attendance_id: Many2One }>(
          "account.analytic.line",
          [["x_attendance_id", "in", attendanceIds]],
          { fields: ["id", "amount", "x_attendance_id"] },
        )
      : Promise.resolve([]),
  ]);

  const jornalById = new Map(employees.map((row) => [row.id, row.x_jornal || 0]));
  const folioById = new Map(projects.map((row) => [row.id, row.x_folio || ""]));
  const costByAttendance = new Map(
    costLines.map((line) => [m2oId(line.x_attendance_id) ?? 0, round2(-line.amount)]),
  );

  return entries.map(({ row, day }) => {
    const kind = (row.x_jornada || "completa") as AttendanceKind;
    const employeeId = m2oId(row.employee_id) ?? 0;
    const projectId = m2oId(row.x_project_id) ?? 0;
    return {
      id: row.id,
      date: day,
      employee_id: employeeId,
      employee_name: m2oName(row.employee_id) ?? "",
      project_id: projectId,
      project_folio: folioById.get(projectId) ?? "",
      kind,
      source: (row.x_source || "web") as AttendanceSource,
      // Una falta no tiene línea: su costo es cero. Para el resto, si por lo
      // que sea no hay línea, se cae al jornal vigente como último recurso.
      cost:
        costByAttendance.get(row.id) ??
        round2((jornalById.get(employeeId) ?? 0) * ATTENDANCE_FACTOR[kind]),
      check_in: row.check_in ? localTimeOf(row.check_in) : undefined,
      registered_by: row.x_registered_by || undefined,
      note: row.x_note || undefined,
    };
  });
}

async function readOne(id: number): Promise<Attendance | null> {
  const rows = await searchRead<OdooAttendance>("hr.attendance", [["id", "=", id]], {
    fields: ATTENDANCE_FIELDS,
  });
  if (rows.length === 0) return null;
  const [row] = await hydrate([{ row: rows[0], day: localDayOf(rows[0].check_in) }]);
  return row ?? null;
}

/** Etapas en las que un proyecto sigue necesitando gente. */
const ACTIVE_STAGE_CODES = ["autorizado", "ejecucion", "por_cerrar"];

export async function handleAttendance(
  action: string,
  payload: Payload,
  session: SessionPayload,
) {
  switch (action) {
    /** Distribución del personal del día. [R-21] */
    case "board": {
      const date = str(payload.date) ?? dayIso(0);
      const entries = await readAttendance(date, date);
      const rows = await hydrate(entries);

      const [employees, crews, stages] = await Promise.all([
        searchRead<OdooEmployee>("hr.employee", [["active", "=", true]], {
          fields: EMPLOYEE_FIELDS,
          order: "name",
        }),
        searchRead<{ id: number; project_id: Many2One; employee_id: Many2One }>(
          "altitud.crew",
          [["active", "=", true]],
          { fields: ["id", "project_id", "employee_id"] },
        ),
        searchRead<{ id: number; x_code: string | false }>(
          "project.project.stage",
          [["x_code", "in", ACTIVE_STAGE_CODES]],
          { fields: ["id", "x_code"] },
        ),
      ]);

      const activeStageIds = stages.map((stage) => stage.id);
      const markedProjectIds = [...new Set(rows.map((row) => row.project_id))].filter(Boolean);

      /**
       * El tablero enseña las obras en curso y, además, cualquiera que tenga
       * registro ese día. Si una obra se cerró con asistencias capturadas, el
       * día tiene que seguir cuadrando con el costo.
       */
      const boardProjects = await searchRead<{
        id: number;
        name: string;
        x_folio: string | false;
        x_area: ProjectArea | false;
        stage_id: Many2One;
      }>(
        "project.project",
        [
          ["x_folio", "!=", false],
          "|",
          ["stage_id", "in", activeStageIds],
          ["id", "in", markedProjectIds],
        ],
        { fields: ["id", "name", "x_folio", "x_area", "stage_id"], order: "x_folio" },
      );

      // Para «sin cuadrilla» solo cuentan las obras en curso: estar en la
      // cuadrilla de una obra cerrada no es tener dónde trabajar.
      const inProgressIds = new Set(
        boardProjects
          .filter((project) => activeStageIds.includes(m2oId(project.stage_id) ?? 0))
          .map((project) => project.id),
      );
      const crewedEmployeeIds = new Set(
        crews
          .filter((crew) => inProgressIds.has(m2oId(crew.project_id) ?? 0))
          .map((crew) => m2oId(crew.employee_id) ?? 0),
      );
      const unassigned = await Promise.all(
        employees.filter((employee) => !crewedEmployeeIds.has(employee.id)).map(toEmployee),
      );

      const marked = new Set(rows.map((row) => row.employee_id));
      const employeeNames = new Map(employees.map((employee) => [employee.id, employee.name]));

      const byProject = boardProjects
        .map((project) => {
          const people = rows.filter((row) => row.project_id === project.id);
          const crewOfProject = crews
            .filter((crew) => m2oId(crew.project_id) === project.id)
            .map((crew) => m2oId(crew.employee_id) ?? 0);
          // Pendientes: están en la cuadrilla y todavía no tienen registro.
          const pending = crewOfProject
            .filter((employeeId) => !marked.has(employeeId))
            .map((employeeId) => ({
              employee_id: employeeId,
              name: employeeNames.get(employeeId) ?? "",
            }));

          return {
            project_id: project.id,
            folio: project.x_folio || "",
            name: project.name,
            area: (project.x_area || "limpieza") as ProjectArea,
            present: people.filter((row) => row.kind !== "falta").length,
            cost: sum(people.map((row) => row.cost)),
            people: people.map((row) => ({
              attendance_id: row.id,
              employee_id: row.employee_id,
              name: row.employee_name,
              kind: row.kind,
              source: row.source,
            })),
            pending,
          };
        })
        .filter((project) => project.people.length > 0 || project.pending.length > 0);

      const areas: ProjectArea[] = ["altura", "limpieza", "obra"];
      const areaOfProject = new Map(
        boardProjects.map((project) => [project.id, project.x_area || "limpieza"]),
      );

      return json({
        date,
        // Odoo no sabe de días hábiles de Altitud; el tablero siempre abre.
        is_workday: true,
        total_employees: employees.length,
        present: rows.filter((row) => row.kind !== "falta").length,
        absent: rows.filter((row) => row.kind === "falta").length,
        unassigned,
        cost_day: sum(rows.map((row) => row.cost)),
        by_area: areas.map((area) => {
          const areaRows = rows.filter((row) => areaOfProject.get(row.project_id) === area);
          return {
            area,
            present: areaRows.filter((row) => row.kind !== "falta").length,
            cost: sum(areaRows.map((row) => row.cost)),
          };
        }),
        by_project: byProject,
      });
    }

    case "list": {
      const term = search(payload.search);
      const date = str(payload.date);
      const projectId = num(payload.project_id, 0);
      const area = str(payload.area);

      const extra: unknown[] = [];
      if (projectId) extra.push(["x_project_id", "=", projectId]);

      // Sin fecha se mira el último mes: la pantalla filtra sobre eso.
      const from = date ?? dayIso(-30);
      const to = date ?? dayIso(0);
      const entries = await readAttendance(from, to, extra);
      let rows = await hydrate(entries);

      if (area && area !== "todas") {
        const projectIds = [...new Set(rows.map((row) => row.project_id))];
        const projects = projectIds.length
          ? await searchRead<{ id: number; x_area: string | false }>(
              "project.project",
              [["id", "in", projectIds]],
              { fields: ["id", "x_area"] },
            )
          : [];
        const inArea = new Set(
          projects.filter((project) => project.x_area === area).map((project) => project.id),
        );
        rows = rows.filter((row) => inArea.has(row.project_id));
      }

      if (term) {
        rows = rows.filter((row) => contains(term, row.employee_name, row.project_folio));
      }

      return json({
        rows: rows.slice(0, 400),
        total: rows.length,
        cost: sum(rows.map((row) => row.cost)),
        jornales: round2(
          rows.reduce((acc, row) => acc + ATTENDANCE_FACTOR[row.kind], 0),
        ),
      });
    }

    /**
     * Personal para capturar.
     *
     * Con `project_id` devuelve la cuadrilla de ese proyecto, que es lo único
     * que se puede marcar. Sin él, el padrón activo (para armar cuadrillas).
     */
    case "employees": {
      const term = search(payload.search);
      const area = str(payload.area);
      const projectId = num(payload.project_id, 0);

      let domain: unknown[] = [["active", "=", true]];
      if (projectId) {
        const crew = await searchRead<{ employee_id: Many2One }>(
          "altitud.crew",
          [
            ["project_id", "=", projectId],
            ["active", "=", true],
          ],
          { fields: ["employee_id"] },
        );
        const ids = crew.map((row) => m2oId(row.employee_id) ?? 0).filter(Boolean);
        if (ids.length === 0) return json({ rows: [] });
        domain = [["id", "in", ids]];
      }

      const rows = await searchRead<OdooEmployee>("hr.employee", domain, {
        fields: EMPLOYEE_FIELDS,
        order: "name",
      });
      const employees = await Promise.all(rows.map(toEmployee));

      return json({
        rows: employees.filter(
          (employee) =>
            (!area || area === "todas" || employee.area === area || employee.area === "mixto") &&
            contains(term, employee.name, employee.job),
        ),
      });
    }

    /** Registro de asistencia ligado a un proyecto. [R-17] [R-19] */
    case "create": {
      const employeeId = num(payload.employee_id);
      const projectId = num(payload.project_id);
      if (!employeeId) return badRequest("Selecciona al colaborador.");
      if (!projectId) return badRequest("Toda asistencia va contra un proyecto.");

      const id = await createAttendance({
        employeeId,
        projectId,
        day: str(payload.date) ?? dayIso(0),
        kind: (str(payload.kind) ?? "completa") as AttendanceKind,
        source: (str(payload.source) ?? "web") as AttendanceSource,
        registeredBy: str(payload.registered_by) ?? session.name,
        note: str(payload.note),
      });

      return json(await readOne(id));
    }

    /** Captura en lote: la cuadrilla del día. */
    case "createBatch": {
      const projectId = num(payload.project_id);
      if (!projectId) return badRequest("Selecciona el proyecto.");

      const day = str(payload.date) ?? dayIso(0);
      const kind = (str(payload.kind) ?? "completa") as AttendanceKind;
      const source = (str(payload.source) ?? "supervisor") as AttendanceSource;
      const ids = Array.isArray(payload.employee_ids)
        ? (payload.employee_ids as unknown[]).map((value) => num(value)).filter(Boolean)
        : [];
      if (ids.length === 0) return badRequest("Selecciona al menos un colaborador.");

      const names = await searchRead<{ id: number; name: string }>(
        "hr.employee",
        [["id", "in", ids]],
        { fields: ["id", "name"], context: { active_test: false } },
      );
      const nameById = new Map(names.map((row) => [row.id, row.name]));

      let created = 0;
      const skipped: string[] = [];
      // Uno por uno: quien no cumpla (ya tiene jornada, no está en la
      // cuadrilla) se reporta sin tumbar el resto del lote.
      for (const employeeId of ids) {
        try {
          await createAttendance({
            employeeId,
            projectId,
            day,
            kind,
            source,
            registeredBy: str(payload.registered_by) ?? session.name,
          });
          created += 1;
        } catch (error) {
          if (error instanceof OdooError && error.status === 400) {
            skipped.push(nameById.get(employeeId) ?? `#${employeeId}`);
          } else {
            throw error;
          }
        }
      }

      return json({ created, skipped });
    }

    /** Reasignar personal entre proyectos. El costo se mueve con él. [R-22] */
    case "reassign": {
      const id = num(payload.id);
      const projectId = num(payload.project_id);
      const current = await readOne(id);
      if (!current) return notFound("La asistencia no existe.");
      if (!projectId) return badRequest("Selecciona el proyecto destino.");

      await write("hr.attendance", [id], { x_project_id: projectId });
      return json(await readOne(id));
    }

    case "setKind": {
      const id = num(payload.id);
      const current = await readOne(id);
      if (!current) return notFound("La asistencia no existe.");

      const kind = (str(payload.kind) ?? current.kind) as AttendanceKind;
      if (!(kind in ATTENDANCE_FACTOR)) return badRequest("Tipo de jornada inválido.");

      await write("hr.attendance", [id], { x_jornada: kind });
      return json(await readOne(id));
    }

    case "remove": {
      const id = num(payload.id);
      const current = await readOne(id);
      if (!current) return notFound("La asistencia no existe.");
      await unlink("hr.attendance", [id]);
      return json({ ok: true });
    }

    case "kinds":
      return json({
        rows: (Object.keys(ATTENDANCE_KIND_LABELS) as AttendanceKind[]).map((kind) => ({
          kind,
          label: ATTENDANCE_KIND_LABELS[kind],
          factor: ATTENDANCE_FACTOR[kind],
        })),
      });

    default:
      return unknownAction(action);
  }
}

/**
 * Alta de la asistencia.
 *
 * `x_day` no es un campo: el addon lo usa para armar el reloj de la jornada
 * y lo descarta. Las validaciones (cuadrilla, una por día) las levanta Odoo
 * como `ValidationError`, que el cliente convierte en 400 con el texto que
 * ya se puede enseñar al usuario.
 */
async function createAttendance(input: {
  employeeId: number;
  projectId: number;
  day: string;
  kind: AttendanceKind;
  source: AttendanceSource;
  registeredBy?: string;
  note?: string;
}): Promise<number> {
  return create("hr.attendance", {
    employee_id: input.employeeId,
    x_project_id: input.projectId,
    x_jornada: input.kind,
    x_source: input.source,
    x_day: input.day,
    x_registered_by: input.registeredBy ?? false,
    x_note: input.note ?? false,
    in_mode: "manual",
    out_mode: "manual",
  });
}
