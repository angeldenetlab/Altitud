import type { CostCategory, Project, ProjectTotals } from "@/types/altitude";
import { CATEGORY_ORDER } from "@/lib/labels";
import { OPERATION_TZ } from "@/lib/odoo/dates";

/**
 * Fórmulas del negocio. Viven en el BFF, no en Odoo.
 *
 * Odoo trae su propio panel de rentabilidad del proyecto, pero no calcula
 * presupuesto devengado ni costo estimado al cierre, que es con lo que aquí
 * se decide. La cifra oficial es esta. Ver la nota «Reglas de negocio» del
 * vault.
 */

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sum(values: number[]): number {
  return round2(values.reduce((acc, value) => acc + value, 0));
}

export function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function search(term: unknown): string {
  return typeof term === "string" ? term.trim().toLocaleLowerCase("es-MX") : "";
}

export function contains(term: string, ...fields: (string | undefined)[]): boolean {
  if (!term) return true;
  return fields.some((field) => field?.toLocaleLowerCase("es-MX").includes(term));
}

/** Avance ponderado por el peso de cada fase. [R-05] */
export function computeProgress(project: Pick<Project, "phases">): number {
  const totalWeight = project.phases.reduce((acc, phase) => acc + phase.weight, 0) || 1;
  const weighted = project.phases.reduce(
    (acc, phase) => acc + (phase.progress * phase.weight) / 100,
    0,
  );
  return Math.round((weighted / totalWeight) * 100);
}

/**
 * Comparativo presupuestado / devengado / real / facturado y rentabilidad.
 * [R-04] [R-07] [R-30]
 *
 * La comparación honesta a media obra es contra el presupuesto **devengado**
 * (lo que debería haberse gastado al avance actual), no contra el presupuesto
 * completo: así se ve el sobrecosto cuando todavía se puede corregir.
 */
export function computeTotals(project: Project): ProjectTotals {
  const progress = computeProgress(project);
  const executed = progress / 100;

  const byCategory = CATEGORY_ORDER.map((category: CostCategory) => {
    const budget = sum(
      project.budget.filter((line) => line.category === category).map((line) => line.amount),
    );
    const actual = sum(
      project.actuals.filter((entry) => entry.category === category).map((entry) => entry.amount),
    );
    const earned = round2(budget * executed);
    return { category, budget, actual, earned, variance: round2(actual - earned) };
  });

  const budgetTotal = sum(byCategory.map((row) => row.budget));
  const actualTotal = sum(byCategory.map((row) => row.actual));
  const earnedTotal = round2(budgetTotal * executed);
  // Lo que falta por gastar según el presupuesto, sumado a lo ya gastado.
  const forecastCost = round2(actualTotal + Math.max(0, budgetTotal - earnedTotal));

  const billableExtras = sum(
    project.extras
      .filter((extra) => extra.kind === "extra" && extra.billable)
      .map((extra) => extra.amount),
  );
  const billableTotal = round2(project.contract_amount + billableExtras);
  const invoicedTotal = project.closure?.invoiced_amount ?? 0;
  // Con el proyecto cerrado ya no hay proyección: el costo es el real.
  const costForMargin = project.closure ? actualTotal : forecastCost;
  const revenueForMargin = project.closure && invoicedTotal > 0 ? invoicedTotal : billableTotal;
  const marginAmount = round2(revenueForMargin - costForMargin);

  return {
    budget_total: budgetTotal,
    actual_total: actualTotal,
    earned_budget: earnedTotal,
    forecast_cost: project.closure ? actualTotal : forecastCost,
    billable_total: billableTotal,
    invoiced_total: invoicedTotal,
    variance: round2(actualTotal - earnedTotal),
    margin_amount: marginAmount,
    margin_pct: revenueForMargin > 0 ? round2((marginAmount / revenueForMargin) * 100) : 0,
    progress,
    by_category: byCategory,
  };
}

/** Proyectos que cuentan como «en curso» para KPIs y tableros. [R-29] */
export function isActiveStage(stage: Project["stage"]): boolean {
  return ["autorizado", "ejecucion", "por_cerrar"].includes(stage);
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: OPERATION_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Fecha de hoy (o con desplazamiento) en ISO corto, **en el huso de la
 * operación**, no en UTC.
 *
 * No es un detalle: México está en UTC−6, así que a partir de las 18:00
 * locales `toISOString()` ya devuelve el día siguiente. Con eso, el supervisor
 * que cierra la cuadrilla a las 18:30 capturaba la jornada en el día
 * equivocado, el tablero del día amanecía vacío y la prenómina cargaba el
 * jornal al periodo que no era.
 */
export function dayIso(offset = 0): string {
  const date = new Date();
  if (offset !== 0) date.setUTCDate(date.getUTCDate() + offset);
  return dayFormatter.format(date);
}
