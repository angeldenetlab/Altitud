"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeDollarSign, ClipboardCopy, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { KpiCard } from "@/components/data/KpiCard";
import { PageHeader } from "@/components/data/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { COMPANY_SHORT } from "@/lib/labels";
import { payrollService } from "@/services/payrollService";

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * Prenómina: jornales del periodo listos para entregar al despacho contable.
 * El timbrado se queda con el despacho. [R-36]
 */
export default function PrenominaPage() {
  const [from, setFrom] = useState(isoDaysAgo(13));
  const [to, setTo] = useState(isoDaysAgo(0));

  const query = useQuery({
    queryKey: ["payroll", from, to],
    queryFn: () => payrollService.period(from, to),
  });

  const exportRows = useQuery({
    queryKey: ["payroll", "export", from, to],
    queryFn: () => payrollService.exportRows(from, to),
  });

  async function copyToClipboard() {
    const data = exportRows.data;
    if (!data) return;
    const text = [data.header, ...data.rows].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${data.count} renglones copiados`);
    } catch {
      toast.error("El navegador no permitió copiar");
    }
  }

  const data = query.data;

  return (
    <div>
      <PageHeader
        title="Prenómina"
        description="Jornales por colaborador según las asistencias del periodo. Se entrega al despacho contable, que hace el timbrado. [R-36]"
        actions={
          <Button variant="outline" onClick={copyToClipboard} disabled={!exportRows.data}>
            <ClipboardCopy className="size-4" />
            Copiar para el despacho
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Colaboradores" value={data?.rows.length ?? 0} icon={Users} isLoading={query.isLoading} />
        <KpiCard label="Jornales" value={data?.total_jornales ?? 0} icon={UserCheck} isLoading={query.isLoading} />
        <KpiCard
          label="Total del periodo"
          value={formatCurrency(data?.total)}
          icon={BadgeDollarSign}
          tone="positive"
          isLoading={query.isLoading}
        />
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Por razón social [R-37]</p>
            <div className="mt-1 grid gap-0.5 text-sm">
              {(data?.by_company ?? []).map((row) => (
                <div key={row.company} className="flex justify-between gap-2">
                  <span>{COMPANY_SHORT[row.company as keyof typeof COMPANY_SHORT] ?? row.company}</span>
                  <span className="tabular-nums font-medium">{formatCurrency(row.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="my-5 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs">Del</Label>
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-44" />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Al</Label>
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-44" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalle del periodo</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="p-6">
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Colaborador</th>
                    <th className="px-5 py-3">Puesto</th>
                    <th className="px-5 py-3">Razón social</th>
                    <th className="px-5 py-3 text-right">Jornal</th>
                    <th className="px-5 py-3 text-right">Jornales</th>
                    <th className="px-5 py-3 text-right">Faltas</th>
                    <th className="px-5 py-3">Proyectos</th>
                    <th className="px-5 py-3 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data?.rows ?? []).map((row) => (
                    <tr key={row.employee_id}>
                      <td className="px-5 py-2.5 font-medium">{row.employee_name}</td>
                      <td className="px-5 py-2.5 text-xs text-muted-foreground">{row.job}</td>
                      <td className="px-5 py-2.5 text-xs">
                        {COMPANY_SHORT[row.company as keyof typeof COMPANY_SHORT] ?? row.company}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{formatCurrency(row.jornal)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-medium">{row.jornales}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {row.faltas > 0 ? (
                          <span className="text-destructive">{row.faltas}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 font-mono text-[11px] text-muted-foreground">
                        {row.projects.join(", ")}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-semibold">
                        {formatCurrency(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border bg-muted/40 font-semibold">
                  <tr>
                    <td className="px-5 py-3" colSpan={4}>
                      Total
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{data?.total_jornales ?? 0}</td>
                    <td className="px-5 py-3" />
                    <td className="px-5 py-3" />
                    <td className="px-5 py-3 text-right tabular-nums">{formatCurrency(data?.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
