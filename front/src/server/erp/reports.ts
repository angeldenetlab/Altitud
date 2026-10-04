import type { CostCategory, ProjectArea, ReportsData } from "@/types/altitude";
import { AREA_SHORT, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/labels";
import { round2, sum } from "@/lib/compute";
import { json, type Payload, unknownAction } from "@/lib/http";
import type { SessionPayload } from "@/lib/auth/server-session";
import { loadProjects } from "@/server/erp/common";

/**
 * Rentabilidad por proyecto y comparada por tipo de servicio. [R-30] [R-31] [R-32]
 *
 * Usa el mismo criterio de margen que `computeTotals`, que ya viene resuelto
 * en los totales de `loadProjects()`: proyecto abierto contra lo cobrable y el
 * costo estimado al cierre; proyecto cerrado contra lo facturado y el costo
 * real. Calcularlo aquí con otra fórmula haría que el cierre del proyecto y
 * este reporte se contradigan.
 *
 * Solo lectura: este despachador nunca escribe en el ERP.
 */

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const AREAS: ProjectArea[] = ["altura", "limpieza", "obra"];

// ---------------------------------------------------------------------------
// Despachador
// ---------------------------------------------------------------------------

export async function handleReports(action: string, payload: Payload, session: SessionPayload) {
  void payload;
  void session;

  if (action !== "overview") return unknownAction(action);

  // Una sola carga por petición: `loadProjects()` ya lee en lote.
  // Lo perdido no se reporta: nunca se ejecutó, así que no tiene rentabilidad.
  const rows = (await loadProjects()).filter((row) => row.stage !== "perdido");

  const profitability: ReportsData["profitability"] = rows
    .filter((row) => row.totals.actual_total > 0)
    .map((row) => ({
      project_id: row.id,
      folio: row.folio,
      name: row.name,
      area: row.area,
      billable: row.totals.billable_total,
      actual: row.totals.forecast_cost,
      margin_amount: row.totals.margin_amount,
      margin_pct: row.totals.margin_pct,
    }))
    // Ascendente: los que peor van encabezan la lista.
    .sort((a, b) => a.margin_pct - b.margin_pct);

  const byArea: ReportsData["by_area"] = AREAS.map((area) => {
    const areaRows = rows.filter((row) => row.area === area);
    const billable = sum(areaRows.map((row) => row.totals.billable_total));
    const actual = sum(areaRows.map((row) => row.totals.forecast_cost));
    return {
      area,
      label: AREA_SHORT[area],
      projects: areaRows.length,
      billable,
      actual,
      margin_pct: billable > 0 ? round2(((billable - actual) / billable) * 100) : 0,
    };
  });

  const byCategory: ReportsData["by_category"] = CATEGORY_ORDER.map((category: CostCategory) => ({
    category,
    label: CATEGORY_LABELS[category],
    amount: sum(
      rows.flatMap((row) =>
        row.actuals.filter((entry) => entry.category === category).map((entry) => entry.amount),
      ),
    ),
  }));

  // Facturado y costo por mes, tomando la fecha de los movimientos.
  const monthly = new Map<string, { facturado: number; costo: number }>();
  const monthKey = (date: string) => date.slice(0, 7);

  rows.forEach((row) => {
    row.actuals.forEach((entry) => {
      const key = monthKey(entry.date);
      const current = monthly.get(key) ?? { facturado: 0, costo: 0 };
      current.costo = round2(current.costo + entry.amount);
      monthly.set(key, current);
    });
    if (row.closure) {
      const key = monthKey(row.closure.closed_at);
      const current = monthly.get(key) ?? { facturado: 0, costo: 0 };
      current.facturado = round2(current.facturado + row.closure.invoiced_amount);
      monthly.set(key, current);
    }
  });

  const monthlyRows: ReportsData["monthly"] = [...monthly.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-6)
    .map(([key, value]) => ({
      month: MONTHS[Number(key.slice(5, 7)) - 1] ?? key,
      facturado: value.facturado,
      costo: value.costo,
    }));

  return json({
    profitability,
    by_area: byArea,
    by_category: byCategory,
    monthly: monthlyRows,
  });
}
