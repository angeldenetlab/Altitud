import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type KpiTone = "default" | "positive" | "negative" | "warning" | "info";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  isLoading?: boolean;
  tone?: KpiTone;
  /** Variación contra el periodo anterior. Positivo = subió. */
  delta?: number;
  /** Cuando subir es malo (gasto, sobrecosto) invierte el color del delta. */
  deltaInverted?: boolean;
}

/* Disco sólido con el icono en blanco: es la pieza que da el acento de color
   a la tarjeta, así que usa los pasos validados a ≥3:1 contra blanco. */
const badgeTone: Record<KpiTone, string> = {
  default: "bg-chart-1 text-white shadow-chart-1/25",
  positive: "bg-success text-white shadow-success/25",
  negative: "bg-destructive text-white shadow-destructive/25",
  warning: "bg-chart-2 text-white shadow-chart-2/25",
  info: "bg-chart-3 text-white shadow-chart-3/25",
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  isLoading,
  tone = "default",
  delta,
  deltaInverted = false,
}: KpiCardProps) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const isUp = hasDelta && delta > 0;
  const isGood = hasDelta && (deltaInverted ? delta < 0 : delta > 0);

  return (
    <Card className="group gap-5 [--card-spacing:--spacing(5)] transition-shadow duration-200 hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_18px_36px_-20px_rgba(15,23,42,0.22)] dark:hover:shadow-[0_18px_36px_-20px_rgba(0,0,0,0.65)]">
      <CardContent className="flex flex-col gap-5">
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-full shadow-lg transition-transform duration-200 group-hover:scale-105",
            badgeTone[tone]
          )}
        >
          <Icon className="size-[22px]" strokeWidth={2} aria-hidden />
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="font-heading text-[28px] leading-none font-bold tracking-tight text-foreground tabular-nums">
                {value}
              </p>
            )}
            <p className="mt-2 truncate text-sm text-muted-foreground">{label}</p>
          </div>

          {hasDelta && !isLoading && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 text-sm font-medium tabular-nums",
                isGood ? "text-success" : "text-destructive"
              )}
            >
              {Math.abs(delta).toFixed(2)}%
              {isUp ? (
                <ArrowUpRight className="size-4" aria-label="al alza" />
              ) : (
                <ArrowDownRight className="size-4" aria-label="a la baja" />
              )}
            </span>
          )}
        </div>

        {hint && (
          <p className="-mt-2 truncate text-xs text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}
