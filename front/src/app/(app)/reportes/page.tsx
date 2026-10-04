"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/data/ChartCard";
import { PageHeader } from "@/components/data/PageHeader";
import { AREA_STATUS, StatusBadge } from "@/components/data/StatusBadge";
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
import { reportsService } from "@/services/reportsService";


/** Rentabilidad por proyecto y comparada por tipo de servicio. [R-30] [R-31] [R-32] */
export default function ReportesPage() {
  const query = useQuery({ queryKey: ["reports"], queryFn: reportsService.overview });
  const data = query.data;
  const byArea = data?.by_area ?? [];
  const byCategory = data?.by_category ?? [];
  const categoryTotal = byCategory.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div>
      <PageHeader
        title="Reportes"
        description="Qué proyectos dejan dinero y qué tipo de servicio conviene empujar. Consulta directa, sin juntar Excels. [R-32]"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Rentabilidad por tipo de servicio"
          description="Lo cobrable contra lo que realmente costó."
          isLoading={query.isLoading}
          isEmpty={byArea.length === 0}
          legend={[
            { label: "Cobrable", color: chartColor(0) },
            { label: "Costo real", color: chartColor(1) },
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
            <Bar dataKey="billable" name="Cobrable" fill={chartColor(0)} {...barProps} />
            <Bar dataKey="actual" name="Costo real" fill={chartColor(1)} {...barProps} />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="Peso de cada partida en el costo"
          description="Dónde se va el dinero de los proyectos."
          isLoading={query.isLoading}
          isEmpty={byCategory.length === 0}
          centerLabel={{ value: formatCurrency(categoryTotal), caption: "costo total" }}
          /* La leyenda lleva el monto: etiqueta directa en vez de buscar la
             rebanada por color. */
          legend={byCategory.map((row, index) => ({
            label: row.label,
            color: chartColor(index),
            value: formatCurrency(row.amount),
          }))}
        >
          <PieChart>
            <Pie
              data={byCategory}
              dataKey="amount"
              nameKey="label"
              innerRadius={62}
              outerRadius={96}
              paddingAngle={2}
              stroke="var(--color-card)"
              strokeWidth={2}
              /* Misma razón que en barProps: la animación de entrada deja los
                 sectores sin path. */
              isAnimationActive={false}
            >
              {byCategory.map((entry, index) => (
                <Cell key={entry.category} fill={chartColor(index)} />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              content={<ChartTooltip hideLabel format={(value) => formatCurrency(value)} />}
            />
          </PieChart>
        </ChartCard>
      </div>

      <Card className="mt-6 [--card-spacing:--spacing(5)]">
        <CardHeader>
          <CardTitle className="text-[15px] font-semibold">Margen por área</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Costo acumulado del periodo: {formatCurrency(categoryTotal)}
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {byArea.map((row) => (
            <div
              key={row.area}
              className="rounded-2xl bg-muted/35 px-4 py-3.5 ring-1 ring-foreground/[0.04]"
            >
              <div className="flex items-center justify-between gap-2">
                <StatusBadge status={row.area} map={AREA_STATUS} />
                <span
                  className={`font-heading text-lg font-bold tabular-nums ${
                    row.margin_pct < 20 ? "text-destructive" : "text-success"
                  }`}
                >
                  {row.margin_pct}%
                </span>
              </div>
              <p className="mt-2.5 text-xs text-muted-foreground">
                {row.projects} proyecto(s) · cobrable {formatCurrency(row.billable)}
              </p>
              <p className="text-xs text-muted-foreground">
                costo real {formatCurrency(row.actual)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-6 [--card-spacing:--spacing(5)]">
        <CardHeader>
          <CardTitle className="text-[15px] font-semibold">Rentabilidad por proyecto</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Ordenada de menor a mayor margen: arriba están los que hay que revisar. [R-30]
          </p>
        </CardHeader>
        <CardContent className="px-0">
          {query.isLoading ? (
            <div className="px-5">
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Folio</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead className="text-right">Cobrable</TableHead>
                  <TableHead className="text-right">Costo real</TableHead>
                  <TableHead className="text-right">Utilidad</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.profitability ?? []).map((row) => (
                  <TableRow key={row.project_id}>
                    <TableCell>
                      <Link
                        href={`/proyectos/${row.project_id}`}
                        className="font-mono text-xs font-semibold text-primary hover:underline"
                      >
                        {row.folio}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-72 truncate">{row.name}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.area} map={AREA_STATUS} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.billable)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.actual)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        row.margin_amount < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {formatCurrency(row.margin_amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-semibold tabular-nums ${
                          row.margin_pct < 15 ? "text-destructive" : "text-success"
                        }`}
                      >
                        {row.margin_pct}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
