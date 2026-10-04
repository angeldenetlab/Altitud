"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  CalendarCheck,
  FileText,
  FolderKanban,
  Percent,
  PieChart,
  TriangleAlert,
  UserCheck,
} from "lucide-react";
import { ChartCard } from "@/components/data/ChartCard";
import { KpiCard } from "@/components/data/KpiCard";
import { PageHeader } from "@/components/data/PageHeader";
import { AREA_STATUS, PROJECT_STAGE, StatusBadge } from "@/components/data/StatusBadge";
import {
  ChartTooltip,
  axisProps,
  barChartProps,
  barProps,
  chartColor,
  cursorProps,
  gridProps,
} from "@/components/data/chart-theme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { dashboardService } from "@/services/dashboardService";

function ProgressBar({ value, tone = "primary" }: { value: number; tone?: "primary" | "danger" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${tone === "danger" ? "bg-destructive" : "bg-chart-1"}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

const SHORTCUTS = [
  { href: "/proyectos", label: "Proyectos y etapas", icon: FolderKanban },
  { href: "/cotizaciones", label: "Cotizaciones por autorizar", icon: FileText },
  { href: "/asistencias", label: "Asistencia del día", icon: CalendarCheck },
  { href: "/reportes", label: "Rentabilidad por servicio", icon: PieChart },
];

/** Tablero de estado de todos los proyectos activos. [R-29] [R-32] */
export default function PanelPage() {
  const query = useQuery({ queryKey: ["dashboard"], queryFn: dashboardService.overview });
  const data = query.data;
  const byArea = data?.by_area ?? [];

  return (
    <div>
      <PageHeader
        title="Panel"
        description="Proyectos activos, gasto real contra presupuesto y avance. Sin abrir un solo Excel."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Proyectos activos"
          value={data?.kpis.active_projects ?? 0}
          icon={FolderKanban}
          isLoading={query.isLoading}
        />
        <KpiCard
          label="Contratado en curso"
          value={formatCurrency(data?.kpis.contracted_amount)}
          icon={BadgeDollarSign}
          tone="positive"
          isLoading={query.isLoading}
          hint={`Gasto a la fecha: ${formatCurrency(data?.kpis.actual_cost)}`}
        />
        <KpiCard
          label="Margen proyectado"
          value={`${data?.kpis.margin_pct ?? 0}%`}
          icon={Percent}
          tone={(data?.kpis.margin_pct ?? 0) >= 25 ? "positive" : "warning"}
          isLoading={query.isLoading}
          hint={`${data?.kpis.overrun_projects ?? 0} proyecto(s) con sobrecosto al avance`}
        />
        <KpiCard
          label="Jornales de la semana"
          value={data?.kpis.jornales_week ?? 0}
          icon={UserCheck}
          tone="info"
          isLoading={query.isLoading}
          hint={`Mano de obra: ${formatCurrency(data?.kpis.labor_cost_week)}`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Presupuesto devengado vs. gasto real"
          description="Por área de servicio, medido al avance reportado."
          isLoading={query.isLoading}
          isEmpty={byArea.length === 0}
          legend={[
            { label: "Esperado al avance", color: chartColor(0) },
            { label: "Gasto real", color: chartColor(1) },
          ]}
          footer={[
            {
              label: "Esperado al avance",
              value: formatCurrency(byArea.reduce((sum, row) => sum + row.budget, 0)),
            },
            {
              label: "Gasto real",
              value: formatCurrency(byArea.reduce((sum, row) => sum + row.actual, 0)),
            },
          ]}
        >
          <BarChart data={byArea} {...barChartProps}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis
              tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`}
              width={56}
              {...axisProps}
            />
            <Tooltip
              cursor={cursorProps}
              content={<ChartTooltip format={(value) => formatCurrency(value)} />}
            />
            <Bar dataKey="budget" name="Esperado al avance" fill={chartColor(0)} {...barProps} />
            <Bar dataKey="actual" name="Gasto real" fill={chartColor(1)} {...barProps} />
          </BarChart>
        </ChartCard>

        <Card className="[--card-spacing:--spacing(5)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-[15px] font-semibold">
              <span className="flex size-8 items-center justify-center rounded-full bg-chart-2/15 text-chart-2">
                <AlertTriangle className="size-4" aria-hidden />
              </span>
              Requiere atención
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {query.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (data?.alerts.length ?? 0) === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-8 text-center text-sm text-muted-foreground">
                Todo en orden por ahora.
              </p>
            ) : (
              data?.alerts.map((alert, index) => (
                <Link
                  key={`${alert.project_id}-${index}`}
                  href={`/proyectos/${alert.project_id}`}
                  className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/60"
                >
                  <span
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
                      alert.severity === "alta"
                        ? "bg-destructive/12 text-destructive"
                        : "bg-chart-2/15 text-chart-2"
                    }`}
                  >
                    <TriangleAlert className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{alert.folio}</p>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 [--card-spacing:--spacing(5)]">
        <CardHeader>
          <CardTitle className="text-[15px] font-semibold">Proyectos en curso</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {query.isLoading ? (
            <div className="px-5">
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Folio / proyecto</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Avance</TableHead>
                  <TableHead className="text-right">Cobrable</TableHead>
                  <TableHead className="text-right">Gasto real</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.board ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/proyectos/${row.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.folio}
                      </Link>
                      <p className="max-w-72 truncate text-xs text-muted-foreground">{row.name}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.area} map={AREA_STATUS} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.stage} map={PROJECT_STAGE} />
                    </TableCell>
                    <TableCell>
                      <div className="flex w-32 items-center gap-2">
                        <ProgressBar value={row.totals.progress} />
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {row.totals.progress}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.totals.billable_total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={row.totals.variance > 0 ? "text-destructive" : undefined}>
                        {formatCurrency(row.totals.actual_total)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={
                          row.totals.margin_pct < 15
                            ? "font-semibold text-destructive"
                            : "font-semibold text-success"
                        }
                      >
                        {row.totals.margin_pct}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SHORTCUTS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 text-sm ring-1 ring-foreground/[0.06] transition-colors hover:bg-muted/50"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-chart-1/12 text-chart-1">
              <Icon className="size-[18px]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}
