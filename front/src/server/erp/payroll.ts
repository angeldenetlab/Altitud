import type { AttendanceKind, CompanyCode, PayrollRow } from "@/types/altitude";
import { ATTENDANCE_FACTOR } from "@/lib/labels";
import { dayIso, round2, str, sum } from "@/lib/compute";
import { json, type Payload, unknownAction } from "@/lib/http";
import type { SessionPayload } from "@/lib/auth/server-session";
import { type Many2One, m2oId, searchRead } from "@/lib/odoo/client";
import { localDayOf, utcRangeForDays } from "@/lib/odoo/dates";
import { getCompanies } from "@/server/erp/common";

/**
 * Prenómina: jornales del periodo listos para el despacho contable. [R-36]
 * El timbrado queda fuera de alcance: aquí no hay ISR ni CFDI de nómina.
 *
 * No depende de un módulo de nómina de Odoo. Es un agregado de la asistencia
 * (`hr.attendance` con `x_jornada`) por colaborador.
 *
 * Cada jornada se paga al jornal que tenía ese día, no al de hoy: el importe
 * sale del costo que quedó congelado en la parte de horas de la asistencia.
 * Así un aumento no repaga hacia atrás lo ya trabajado, y la prenómina cuadra
 * peso por peso con la mano de obra que carga el proyecto.
 *
 * Es la misma línea analítica, leída para dos cosas distintas, no sumada dos
 * veces: aquí es el jornal del periodo, allá es el costo de la obra.
 *
 * Solo lectura: este despachador nunca escribe en el ERP.
 */

// ---------------------------------------------------------------------------
// Lectura de la asistencia
// ---------------------------------------------------------------------------

interface OdooAttendance {
  id: number;
  employee_id: Many2One;
  check_in: string;
  x_jornada: AttendanceKind | false;
  x_project_id: Many2One;
}

interface OdooEmployee {
  id: number;
  name: string;
  job_title: string | false;
  x_jornal: number;
  company_id: Many2One;
}

/** Asistencia ya normalizada al día local y con la jornada validada. */
interface WorkedDay {
  attendanceId: number;
  employeeId: number;
  projectId: number | undefined;
  kind: AttendanceKind;
}

/**
 * Una jornada de Altitud siempre trae `x_jornada`. Un checado de kiosco de
 * Odoo llega sin ella y no es parte del corte. [R-20]
 */
function attendanceKindOf(value: AttendanceKind | false): AttendanceKind | undefined {
  if (value === "completa" || value === "media" || value === "falta") return value;
  return undefined;
}

/**
 * Jornales del rango, por colaborador.
 *
 * `check_in` se guarda en UTC y la jornada se ancla a las 08:00 locales, así
 * que el día de una asistencia del 1 de octubre puede venir como
 * `2026-10-01 14:00:00`. El dominio se abre un día por lado (`utcRangeForDays`)
 * y el recorte fino se hace en JS con `localDayOf`, que sí sabe de husos y
 * horario de verano. Recortar `check_in` a 10 caracteres contaría las jornadas
 * de la tarde en el día equivocado y la prenómina saldría mal.
 */
async function buildPayroll(payload: Payload): Promise<{
  from: string;
  to: string;
  rows: PayrollRow[];
}> {
  const to = str(payload.to) ?? dayIso(0);
  const from = str(payload.from) ?? dayIso(-13);
  const [utcFrom, utcTo] = utcRangeForDays(from, to);

  const raw = await searchRead<OdooAttendance>(
    "hr.attendance",
    [
      ["x_jornada", "!=", false],
      ["check_in", ">=", utcFrom],
      ["check_in", "<=", utcTo],
    ],
    { fields: ["id", "employee_id", "check_in", "x_jornada", "x_project_id"], order: "check_in" },
  );

  const worked: WorkedDay[] = [];
  raw.forEach((row) => {
    const kind = attendanceKindOf(row.x_jornada);
    if (!kind) return;
    const day = localDayOf(row.check_in);
    if (day < from || day > to) return;
    const employeeId = m2oId(row.employee_id);
    if (!employeeId) return;
    worked.push({
      attendanceId: row.id,
      employeeId,
      projectId: m2oId(row.x_project_id),
      kind,
    });
  });

  if (worked.length === 0) return { from, to, rows: [] };

  const employeeIds = [...new Set(worked.map((row) => row.employeeId))];
  const projectIds = [
    ...new Set(worked.map((row) => row.projectId).filter((id): id is number => !!id)),
  ];

  // Una consulta por colección: nada de leer el colaborador dentro del ciclo.
  const [employees, projects, companies, costLines] = await Promise.all([
    // `active_test` apagado a propósito: a quien se da de baja a mitad del
    // periodo hay que pagarle los días que sí trabajó. Con el filtro por
    // omisión desaparecía del corte y el despacho no lo pagaba, aunque su
    // jornal ya estuviera costeado en el proyecto.
    searchRead<OdooEmployee>("hr.employee", [["id", "in", employeeIds]], {
      fields: ["id", "name", "job_title", "x_jornal", "company_id"],
      order: "name",
      context: { active_test: false },
    }),
    projectIds.length
      ? searchRead<{ id: number; x_folio: string | false }>(
          "project.project",
          [["id", "in", projectIds]],
          { fields: ["id", "x_folio"] },
        )
      : Promise.resolve([]),
    getCompanies(),
    // El importe de cada jornada es el que se congeló al capturarla.
    searchRead<{ id: number; amount: number; x_attendance_id: Many2One }>(
      "account.analytic.line",
      [["x_attendance_id", "in", worked.map((row) => row.attendanceId)]],
      { fields: ["id", "amount", "x_attendance_id"] },
    ),
  ]);

  const costByAttendance = new Map(
    costLines.map((line) => [m2oId(line.x_attendance_id) ?? 0, round2(-line.amount)]),
  );

  // El folio del proyecto, no su nombre: es lo que lee el despacho.
  const folioById = new Map(projects.map((row) => [row.id, row.x_folio || `PRJ-${row.id}`]));

  const byEmployee = new Map<number, WorkedDay[]>();
  worked.forEach((row) => {
    const list = byEmployee.get(row.employeeId);
    if (list) list.push(row);
    else byEmployee.set(row.employeeId, [row]);
  });

  // Al corte entra todo el que trabajó en el periodo, incluido quien se dio
  // de baja a media quincena: sus días ya están costeados en el proyecto y
  // hay que pagarlos.
  const rows: PayrollRow[] = employees
    .map((employee): PayrollRow => {
      const own = byEmployee.get(employee.id) ?? [];
      const jornales = round2(own.reduce((acc, row) => acc + ATTENDANCE_FACTOR[row.kind], 0));

      // Una falta no tiene línea y no cuesta. Si por lo que sea faltara la
      // línea de una jornada con costo, se cae al jornal vigente.
      const amount = sum(
        own.map(
          (row) =>
            costByAttendance.get(row.attendanceId) ??
            round2((employee.x_jornal || 0) * ATTENDANCE_FACTOR[row.kind]),
        ),
      );

      // El jornal que se enseña es el que de verdad se aplicó. Si en el
      // periodo hubo un aumento, es el promedio efectivo, para que el
      // despacho pueda verificar jornal × jornales contra el importe.
      const jornal = jornales > 0 ? round2(amount / jornales) : round2(employee.x_jornal || 0);

      return {
        employee_id: employee.id,
        employee_name: employee.name,
        job: employee.job_title || "Sin puesto",
        company: (companies.byId.get(m2oId(employee.company_id) ?? 0) ?? "altitude") as CompanyCode,
        jornal,
        jornales,
        faltas: own.filter((row) => row.kind === "falta").length,
        amount,
        projects: Array.from(
          new Set(
            own
              .map((row) => (row.projectId ? folioById.get(row.projectId) : undefined))
              .filter((folio): folio is string => !!folio),
          ),
        ),
      };
    })
    .filter((row) => row.jornales > 0 || row.faltas > 0)
    .sort((a, b) => b.amount - a.amount);

  return { from, to, rows };
}

// ---------------------------------------------------------------------------
// Despachador
// ---------------------------------------------------------------------------

export async function handlePayroll(action: string, payload: Payload, session: SessionPayload) {
  void session;

  switch (action) {
    /** Corte del periodo: por omisión, las dos últimas semanas. [R-36] */
    case "period": {
      const { from, to, rows } = await buildPayroll(payload);
      const companies: CompanyCode[] = ["altitude", "servicios"];

      return json({
        from,
        to,
        rows,
        total: sum(rows.map((row) => row.amount)),
        total_jornales: round2(rows.reduce((acc, row) => acc + row.jornales, 0)),
        by_company: companies.map((company) => ({
          company,
          amount: sum(rows.filter((row) => row.company === company).map((row) => row.amount)),
          people: rows.filter((row) => row.company === company).length,
        })),
      });
    }

    /**
     * La entrega al despacho se devuelve como texto separado por tabuladores
     * para copiar y pegar. Quien no trabajó no aparece en el archivo, aunque
     * tenga faltas registradas.
     */
    case "export": {
      const { from, to, rows } = await buildPayroll(payload);
      const lines = rows
        .filter((row) => row.jornales > 0)
        .map((row) =>
          [
            row.employee_name,
            row.job,
            row.company,
            String(row.jornal),
            String(row.jornales),
            // El importe es el del corte, no un producto recalculado: si en
            // el periodo hubo un aumento, `jornal` es el promedio efectivo y
            // multiplicarlo otra vez daría un centavo de diferencia.
            row.amount.toFixed(2),
          ].join("\t"),
        );

      return json({
        from,
        to,
        header: ["Colaborador", "Puesto", "Razón social", "Jornal", "Jornales", "Importe"].join(
          "\t",
        ),
        rows: lines,
        count: lines.length,
        note: "Pega esta tabla en el formato del despacho contable.",
      });
    }

    default:
      return unknownAction(action);
  }
}
