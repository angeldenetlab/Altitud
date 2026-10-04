"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Rampa categórica del proyecto, en orden fijo. Nunca se cicla: una sexta
 *  serie se agrupa en "Otros" o se separa en gráficas pequeñas. */
export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
] as const;

export const chartColor = (index: number) => CHART_COLORS[index % CHART_COLORS.length];

/** Ejes recesivos: sin línea, sin marcas, tipografía de texto (no de serie). */
export const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--color-chart-axis)", fontSize: 12 },
  tickMargin: 10,
} as const;

/** Rejilla horizontal punteada; las verticales sólo añaden ruido. */
export const gridProps = {
  vertical: false,
  strokeDasharray: "4 4",
  stroke: "var(--color-chart-grid)",
} as const;

/** Barras delgadas, extremo superior redondeado anclado a la base, 2px de
 *  respiro entre barras adyacentes.
 *
 *  Sin animación de entrada a propósito: en Recharts 3 la capa de formas se
 *  monta vacía y la gráfica se queda en blanco hasta el primer resize. Una
 *  gráfica que siempre pinta vale más que el barrido de entrada. */
export const barProps = {
  radius: [6, 6, 0, 0] as [number, number, number, number],
  maxBarSize: 34,
  isAnimationActive: false,
} as const;

export const barChartProps = {
  barGap: 2,
  barCategoryGap: "28%",
} as const;

/** Resalte del hover: un velo tenue en vez del bloque gris de Recharts. */
export const cursorProps = {
  fill: "var(--color-chart-grid)",
  radius: 8,
} as const;

interface TooltipPayloadItem {
  name?: ReactNode;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: ReactNode;
  /** Formateador del valor; por defecto moneda del proyecto. */
  format?: (value: number) => string;
  /** Etiqueta de cabecera alterna (p. ej. el nombre de la rebanada). */
  labelFormatter?: (label: ReactNode) => ReactNode;
  hideLabel?: boolean;
}

/** Tooltip sobre superficie de tarjeta: el punto de color lleva la identidad,
 *  el texto se queda en tinta neutra. */
export function ChartTooltip({
  active,
  payload,
  label,
  format,
  labelFormatter,
  hideLabel,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const fmt = format ?? ((value: number) => value.toLocaleString("es-MX"));

  return (
    <div className="min-w-40 rounded-xl border border-border/60 bg-popover/95 px-3 py-2.5 text-popover-foreground shadow-[0_8px_30px_-12px_rgba(15,23,42,0.35)] backdrop-blur-sm">
      {!hideLabel && label != null && (
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      <ul className="grid gap-1">
        {payload.map((item, index) => (
          <li
            key={`${item.dataKey ?? index}`}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[3px] ring-2 ring-popover"
                style={{ backgroundColor: item.color }}
              />
              {item.name}
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {typeof item.value === "number" ? fmt(item.value) : item.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface LegendItem {
  label: string;
  color: string;
  value?: string;
}

/** Leyenda propia: siempre presente a partir de dos series, para que la
 *  identidad no dependa sólo del color. */
export function ChartLegend({
  items,
  className,
}: {
  items: LegendItem[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-xs">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-muted-foreground">{item.label}</span>
          {item.value && (
            <span className="font-medium tabular-nums text-foreground">{item.value}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
