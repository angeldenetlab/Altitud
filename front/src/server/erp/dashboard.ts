import type { AttendanceKind, DashboardData, ProjectArea } from "@/types/altitude";
import { AREA_SHORT, ATTENDANCE_FACTOR } from "@/lib/labels";
import { dayIso, isActiveStage, round2, sum } from "@/lib/compute";
import { json, type Payload, unknownAction } from "@/lib/http";
import type { SessionPayload } from "@/lib/auth/server-session";
import { type Many2One, m2oId, searchCount, searchRead } from "@/lib/odoo/client";
import { localDayOf, utcRangeForDays } from "@/lib/odoo/dates";
import { loadProjects } from "@/server/erp/common";

/**
 * Tablero de estado de todos los proyectos activos. [R-29] [R-32]
 *
 * Los números salen de los mismos proyectos, cotizaciones y asistencias que
 * alimentan el resto del sistema: `loadProjects()` ya trae presupuesto, gasto
 * real y totales calculados con `computeTotals`, así que aquí no se vuelve a
 * calcular nada. Si el panel usara otra fórmula, contradiría al cierre del
 * proyecto y a Reportes.
 *
 * Solo lectura: este despachador nunca escribe en el ERP.
 */

const AREAS: ProjectArea[] = ["altura", "limpieza", "obra"];

/** Cotizaciones que todavía esperan una decisión. [R-13] */
const PENDING_QUOTE_STATUS = ["levantamiento", "calculo", "vobo_socio", "enviada"];

/** El importe del sobrecosto se lee en pesos cerrados, sin centavos. */
const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

interface OdooAttendance {
  id: number;
  employee_id: Many2One;
  check_in: string;
  x_jornada: AttendanceKind | false;
}

function attendanceKindOf(value: AttendanceKind | false): AttendanceKind | undefined {
  if (value === "completa" || value === "media" || value === "falta") return value;
  return undefined;
}

/**
 * Jornales y costo de mano de obra de los últimos siete días. [R-20]
 *
 * `check_in` está en UTC y la jornada se ancla a las 08:00 locales: el día de
 * la asistencia es la parte de fecha de `check_in` **convertida** a
 * America/Mexico_City. El dominio se abre un día hacia atrás y el corte fino
 * se hace en JS con `localDayOf`.
 */
async function weekLabor(weekFrom: string): Promise<{ jornales: number; cost: number }> {
  const [utcFrom] = utcRangeForDays(weekFrom, weekFrom);

  // La semana termina hoy: una jornada capturada con fecha futura no es
  // costo de esta semana y no tiene por qué inflar el KPI.
  const weekTo = dayIso(0);
  const [, utcTo] = utcRangeForDays(weekTo, weekTo);

  const raw = await searchRead<OdooAttendance>(
    "hr.attendance",
    [
      ["x_jornada", "!=", false],
      ["check_in", ">=", utcFrom],
      ["check_in", "<=", utcTo],
    ],
    { fields: ["id", "employee_id", "check_in", "x_jornada"], order: "check_in" },
  );

  const week: { attendanceId: number; employeeId: number; kind: AttendanceKind }[] = [];
  raw.forEach((row) => {
    const kind = attendanceKindOf(row.x_jornada);
    if (!kind) return;
    const day = localDayOf(row.check_in);
    if (day < weekFrom || day > weekTo) return;
    const employeeId = m2oId(row.employee_id);
    if (!employeeId) return;
    week.push({ attendanceId: row.id, employeeId, kind });
  });

  if (week.length === 0) return { jornales: 0, cost: 0 };

  /**
   * El costo sale de la parte de horas que dejó cada asistencia, que es la
   * misma cifra que carga el proyecto. Recalcularlo con el jornal de hoy haría
   * que el panel y la ficha del proyecto dijeran números distintos en cuanto
   * alguien recibe un aumento.
   */
  const costLines = await searchRead<{ id: number; amount: number; x_attendance_id: Many2One }>(
    "account.analytic.line",
    [["x_attendance_id", "in", week.map((row) => row.attendanceId)]],
    { fields: ["id", "amount", "x_attendance_id"] },
  );
  const costByAttendance = new Map(
    costLines.map((line) => [m2oId(line.x_attendance_id) ?? 0, round2(-line.amount)]),
  );

  return {
    jornales: round2(week.reduce((acc, row) => acc + ATTENDANCE_FACTOR[row.kind], 0)),
    cost: sum(week.map((row) => costByAttendance.get(row.attendanceId) ?? 0)),
  };
}

// ---------------------------------------------------------------------------
// Despachador
// ---------------------------------------------------------------------------

export async function handleDashboard(action: string, payload: Payload, session: SessionPayload) {
  void payload;
  void session;

  if (action !== "overview") return unknownAction(action);

  const weekFrom = dayIso(-6);
  // Las tres lecturas son independientes: van en paralelo, no en cascada.
  const [rows, labor, quotesPending] = await Promise.all([
    loadProjects(),
    weekLabor(weekFrom),
    searchCount("sale.order", [["x_status", "in", PENDING_QUOTE_STATUS]]),
  ]);

  const active = rows.filter((row) => isActiveStage(row.stage));

  const byArea: DashboardData["by_area"] = AREAS.map((area) => {
    const areaRows = rows.filter((row) => row.area === area && row.stage !== "perdido");
    const budget = sum(areaRows.map((row) => row.totals.earned_budget));
    const actual = sum(areaRows.map((row) => row.totals.actual_total));
    const billable = sum(areaRows.map((row) => row.totals.billable_total));
    const forecast = sum(areaRows.map((row) => row.totals.forecast_cost));
    return {
      area,
      label: AREA_SHORT[area],
      // Presupuesto devengado: comparable contra el gasto a la fecha.
      budget,
      actual,
      margin_pct: billable > 0 ? round2(((billable - forecast) / billable) * 100) : 0,
    };
  });

  // Alertas: lo que un socio quiere ver sin abrir nada más.
  const alerts: DashboardData["alerts"] = active
    .flatMap((row) => {
      const list: DashboardData["alerts"] = [];
      if (row.totals.variance > 0 && row.totals.progress < 100) {
        list.push({
          project_id: row.id,
          folio: row.folio,
          name: row.name,
          message: `Gasto real por encima de lo presupuestado al avance en ${MXN.format(
            row.totals.variance,
          )}`,
          severity: "alta",
        });
      }
      const faltantes = row.extras.filter((extra) => extra.kind === "faltante");
      if (faltantes.length > 0) {
        list.push({
          project_id: row.id,
          folio: row.folio,
          name: row.name,
          message: `${faltantes.length} faltante(s) sin contemplar en el presupuesto`,
          severity: "media",
        });
      }
      if (row.stage === "por_cerrar" && !row.closure) {
        list.push({
          project_id: row.id,
          folio: row.folio,
          name: row.name,
          message: "Terminado pero sin cierre: no se conoce su rentabilidad final",
          severity: "alta",
        });
      }
      return list;
    })
    .slice(0, 6);

  const billable = sum(active.map((row) => row.totals.billable_total));
  const actual = sum(active.map((row) => row.totals.actual_total));
  // El margen se mide contra el costo estimado al cierre, no contra el gasto
  // a la fecha: a media obra lo otro siempre se ve bien.
  const forecast = sum(active.map((row) => row.totals.forecast_cost));

  return json({
    kpis: {
      active_projects: active.length,
      contracted_amount: billable,
      actual_cost: actual,
      margin_pct: billable > 0 ? round2(((billable - forecast) / billable) * 100) : 0,
      forecast_cost: forecast,
      overrun_projects: active.filter((row) => row.totals.variance > 0).length,
      quotes_pending: quotesPending,
      jornales_week: labor.jornales,
      labor_cost_week: labor.cost,
    },
    board: active.sort((a, b) => b.totals.billable_total - a.totals.billable_total),
    by_area: byArea,
    alerts,
  });
}
