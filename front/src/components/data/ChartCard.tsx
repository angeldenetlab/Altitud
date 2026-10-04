"use client";

import type { ReactElement, ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartLegend, type LegendItem } from "@/components/data/chart-theme";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  description?: string;
  /** Control del encabezado: rango de fechas, filtro de dimensión, etc. */
  action?: ReactNode;
  legend?: LegendItem[];
  /** Resumen al pie, al estilo "Recibido / Por cobrar". */
  footer?: { label: string; value: string; tone?: "default" | "positive" | "negative" }[];
  height?: number;
  /** Cifra al centro del área de trazo; pensada para la dona. */
  centerLabel?: { value: string; caption?: string };
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  className?: string;
  children: ReactElement;
}

const footerTone = {
  default: "text-foreground",
  positive: "text-success",
  negative: "text-destructive",
} as const;

/** Envoltura única de toda gráfica: encabezado, filtro, leyenda y pie de
 *  cifras. Mantiene idénticos el alto, los estados de carga y los vacíos. */
export function ChartCard({
  title,
  description,
  action,
  legend,
  footer,
  height = 288,
  centerLabel,
  isLoading,
  isEmpty,
  emptyMessage = "Sin datos para este periodo.",
  className,
  children,
}: ChartCardProps) {
  return (
    <Card className={cn("[--card-spacing:--spacing(5)]", className)}>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="text-[15px] font-semibold">{title}</CardTitle>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </CardHeader>

      {legend && legend.length > 0 && (
        <div className="px-(--card-spacing)">
          <ChartLegend items={legend} />
        </div>
      )}

      <CardContent>
        {isLoading ? (
          <Skeleton className="w-full rounded-xl" style={{ height }} />
        ) : isEmpty ? (
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 text-muted-foreground"
            style={{ height }}
          >
            <BarChart3 className="size-7 opacity-40" aria-hidden />
            <p className="text-sm">{emptyMessage}</p>
          </div>
        ) : (
          <div className="relative" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              {children}
            </ResponsiveContainer>
            {centerLabel && (
              /* Superpuesto en HTML en vez de un <Label> de Recharts: éste no
                 se monta dentro del Pie y deja el centro vacío. */
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="font-heading text-xl font-bold tabular-nums text-foreground">
                  {centerLabel.value}
                </p>
                {centerLabel.caption && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{centerLabel.caption}</p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {footer && footer.length > 0 && (
        <div className="mx-(--card-spacing) grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
          {footer.map((item) => (
            <div key={item.label} className="min-w-0 text-center">
              <p className="truncate text-xs text-muted-foreground">{item.label}</p>
              <p
                className={cn(
                  "mt-1 font-heading text-lg font-bold tabular-nums",
                  footerTone[item.tone ?? "default"]
                )}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
