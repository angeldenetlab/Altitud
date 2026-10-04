"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { projectsService } from "@/services/projectsService";
import type { ProjectRow } from "@/types/altitude";

/**
 * Cierre de proyecto: comparativo presupuestado / real / facturado y la
 * rentabilidad final. Es la pieza que hoy no existe. [R-07] [R-30]
 */
export function ProjectCloseTab({ project, canClose }: { project: ProjectRow; canClose: boolean }) {
  const queryClient = useQueryClient();
  const [invoiced, setInvoiced] = useState(
    String(project.closure?.invoiced_amount ?? project.totals.billable_total),
  );
  const [refs, setRefs] = useState((project.closure?.invoice_refs ?? []).join(", "));
  const [notes, setNotes] = useState(project.closure?.notes ?? "");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project", project.id] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
  };

  const close = useMutation({
    mutationFn: () =>
      projectsService.close({
        id: project.id,
        invoiced_amount: Number(invoiced || 0),
        invoice_refs: refs
          .split(",")
          .map((ref) => ref.trim())
          .filter(Boolean),
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Proyecto cerrado");
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "No se pudo cerrar el proyecto"),
  });

  const reopen = useMutation({
    mutationFn: () => projectsService.reopen(project.id),
    onSuccess: () => {
      toast.success("Cierre reabierto");
      invalidate();
    },
  });

  const invoicedAmount = project.closure?.invoiced_amount ?? 0;
  const realMargin = project.closure
    ? invoicedAmount - project.totals.actual_total
    : project.totals.margin_amount;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Comparativo del proyecto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Presupuestado</p>
              <p className="font-heading text-lg font-bold">
                {formatCurrency(project.totals.budget_total)}
              </p>
            </div>
            <div className="rounded-xl border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Gasto real</p>
              <p
                className={cn(
                  "font-heading text-lg font-bold",
                  project.totals.variance > 0 ? "text-destructive" : "text-foreground",
                )}
              >
                {formatCurrency(project.totals.actual_total)}
              </p>
            </div>
            <div className="rounded-xl border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Facturado</p>
              <p className="font-heading text-lg font-bold">
                {project.closure ? formatCurrency(invoicedAmount) : "—"}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Partida</th>
                  <th className="px-4 py-2.5 text-right">Presupuestado</th>
                  <th className="px-4 py-2.5 text-right">Real</th>
                  <th className="px-4 py-2.5 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {project.totals.by_category.map((row) => (
                  <tr key={row.category}>
                    <td className="px-4 py-2.5">{CATEGORY_LABELS[row.category]}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(row.budget)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(row.actual)}</td>
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right tabular-nums",
                        row.actual - row.budget > 0 ? "text-destructive" : "text-success",
                      )}
                    >
                      {row.actual - row.budget > 0 ? "+" : ""}
                      {formatCurrency(row.actual - row.budget)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-muted/50 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Cobrable (venta + extras)</p>
              <p className="font-heading text-base font-bold">
                {formatCurrency(project.totals.billable_total)}
              </p>
            </div>
            <div className="rounded-xl bg-muted/50 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">
                {project.closure ? "Utilidad" : "Utilidad proyectada"}
              </p>
              <p
                className={cn(
                  "font-heading text-base font-bold",
                  realMargin < 0 ? "text-destructive" : "text-success",
                )}
              >
                {formatCurrency(realMargin)}
              </p>
            </div>
            <div className="rounded-xl bg-muted/50 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Rentabilidad</p>
              <p
                className={cn(
                  "font-heading text-base font-bold",
                  project.totals.margin_pct < 15 ? "text-destructive" : "text-success",
                )}
              >
                {project.totals.margin_pct}%
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {project.closure
              ? "Con el proyecto cerrado la utilidad se calcula contra lo realmente facturado."
              : `Mientras el proyecto está abierto se proyecta el costo al cierre: ${formatCurrency(
                  project.totals.forecast_cost,
                )}.`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{project.closure ? "Cierre registrado" : "Cerrar proyecto"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {project.closure ? (
            <>
              <div className="grid gap-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Cerrado el</span>{" "}
                  {formatDate(project.closure.closed_at)}
                </p>
                <p>
                  <span className="text-muted-foreground">Por</span> {project.closure.closed_by}
                </p>
                <p>
                  <span className="text-muted-foreground">Facturas</span>{" "}
                  {project.closure.invoice_refs.join(", ") || "—"}
                </p>
                {project.closure.notes && (
                  <p className="mt-1 rounded-lg bg-muted/60 px-3 py-2 text-xs">{project.closure.notes}</p>
                )}
              </div>
              {canClose && (
                <Button variant="outline" onClick={() => reopen.mutate()} disabled={reopen.isPending}>
                  {reopen.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                  Reabrir cierre
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                El comprobante se emite en CONTPAQi: aquí solo se captura el monto y el folio
                para poder comparar contra el costo. [R-35]
              </p>
              <div className="grid gap-1.5">
                <Label>Monto facturado</Label>
                <Input
                  type="number"
                  value={invoiced}
                  onChange={(event) => setInvoiced(event.target.value)}
                  disabled={!canClose}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Folios de factura</Label>
                <Input
                  value={refs}
                  onChange={(event) => setRefs(event.target.value)}
                  placeholder="A-1234, A-1235"
                  disabled={!canClose}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Observaciones del cierre</Label>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  disabled={!canClose}
                  placeholder="Qué salió bien, qué se subestimó…"
                />
              </div>
              <Button onClick={() => close.mutate()} disabled={!canClose || close.isPending}>
                {close.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Cerrar proyecto
              </Button>
              {!canClose && (
                <p className="text-xs text-muted-foreground">
                  Solo un socio puede cerrar el proyecto. [R-33]
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
