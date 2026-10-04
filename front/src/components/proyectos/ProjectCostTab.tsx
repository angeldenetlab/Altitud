"use client";

import { Fragment, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SelectField } from "@/components/data/SelectField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { projectsService } from "@/services/projectsService";
import type { CostCategory, ProjectRow } from "@/types/altitude";

const CATEGORY_ITEMS = CATEGORY_ORDER.map((category) => ({
  value: category,
  label: CATEGORY_LABELS[category],
}));

const SOURCE_LABELS: Record<string, string> = {
  compra: "Compra",
  asistencia: "Asistencia",
  gasto_campo: "Gasto de campo",
  manual: "Captura manual",
};

type DraftLine = {
  key: string;
  id?: number;
  category: CostCategory;
  concept: string;
  unit: string;
  qty: string;
  unit_cost: string;
};

/**
 * Presupuesto base contra gasto real, partida por partida. [R-03] [R-04]
 *
 * El gasto real casi nunca se captura aquí: llega de compras, asistencias y
 * gastos de campo. Esta pantalla lo muestra y permite el ajuste manual.
 */
export function ProjectCostTab({ project, canWrite }: { project: ProjectRow; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [spendOpen, setSpendOpen] = useState(false);
  const [expanded, setExpanded] = useState<CostCategory | null>(null);

  const [lines, setLines] = useState<DraftLine[]>([]);
  const [spend, setSpend] = useState({
    category: "materiales" as CostCategory,
    concept: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    reference: "",
  });

  function openEditor() {
    setLines(
      project.budget.map((line) => ({
        key: `line-${line.id}`,
        id: line.id,
        category: line.category,
        concept: line.concept,
        unit: line.unit,
        qty: String(line.qty),
        unit_cost: String(line.unit_cost),
      })),
    );
    setEditOpen(true);
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project", project.id] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const saveBudget = useMutation({
    mutationFn: () =>
      projectsService.saveBudget(
        project.id,
        lines
          .filter((line) => line.concept.trim())
          .map((line) => ({
            id: line.id,
            category: line.category,
            concept: line.concept,
            unit: line.unit,
            qty: Number(line.qty || 0),
            unit_cost: Number(line.unit_cost || 0),
          })),
      ),
    onSuccess: () => {
      toast.success("Presupuesto actualizado");
      setEditOpen(false);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "No se pudo guardar el presupuesto"),
  });

  const addSpend = useMutation({
    mutationFn: () =>
      projectsService.addActual({
        id: project.id,
        category: spend.category,
        concept: spend.concept,
        amount: Number(spend.amount || 0),
        date: spend.date,
        reference: spend.reference || undefined,
      }),
    onSuccess: () => {
      toast.success("Gasto registrado");
      setSpendOpen(false);
      setSpend((current) => ({ ...current, concept: "", amount: "", reference: "" }));
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "No se pudo registrar el gasto"),
  });

  const draftTotal = lines.reduce(
    (acc, line) => acc + Number(line.qty || 0) * Number(line.unit_cost || 0),
    0,
  );

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Presupuesto vs. gasto real</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              La desviación compara el gasto contra lo que debería haberse gastado al avance
              actual ({project.totals.progress}%), no contra el presupuesto completo.
            </p>
          </div>
          {canWrite && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={openEditor}>
                <Pencil className="size-4" />
                Editar presupuesto
              </Button>
              <Button size="sm" onClick={() => setSpendOpen(true)}>
                <Plus className="size-4" />
                Registrar gasto
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Partida</th>
                  <th className="px-5 py-3 text-right">Presupuestado</th>
                  <th className="px-5 py-3 text-right">Esperado al avance</th>
                  <th className="px-5 py-3 text-right">Real</th>
                  <th className="px-5 py-3 text-right">Desviación</th>
                  <th className="px-5 py-3">Consumo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {project.totals.by_category.map((row) => {
                  const pct = row.earned > 0 ? Math.round((row.actual / row.earned) * 100) : 0;
                  const over = row.variance > 0;
                  const isOpen = expanded === row.category;

                  return (
                    <Fragment key={row.category}>
                      <tr
                        className="cursor-pointer hover:bg-primary/[0.04]"
                        onClick={() => setExpanded(isOpen ? null : row.category)}
                      >
                        <td className="px-5 py-3 font-medium">{CATEGORY_LABELS[row.category]}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{formatCurrency(row.budget)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                          {formatCurrency(row.earned)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">{formatCurrency(row.actual)}</td>
                        <td
                          className={cn(
                            "px-5 py-3 text-right tabular-nums font-medium",
                            over ? "text-destructive" : "text-success",
                          )}
                        >
                          {over ? "+" : ""}
                          {formatCurrency(row.variance)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex w-40 items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn("h-full rounded-full", over ? "bg-destructive" : "bg-primary")}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <span className="tabular-nums text-xs text-muted-foreground">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-muted/30">
                          <td colSpan={6} className="px-5 py-4">
                            <div className="grid gap-4 lg:grid-cols-2">
                              <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Presupuestado
                                </p>
                                <ul className="flex flex-col gap-1">
                                  {project.budget
                                    .filter((line) => line.category === row.category)
                                    .map((line) => (
                                      <li key={line.id} className="flex justify-between gap-3 text-xs">
                                        <span className="min-w-0 truncate">
                                          {line.concept}
                                          <span className="text-muted-foreground">
                                            {" "}
                                            · {line.qty} {line.unit} × {formatCurrency(line.unit_cost)}
                                          </span>
                                        </span>
                                        <span className="tabular-nums">{formatCurrency(line.amount)}</span>
                                      </li>
                                    ))}
                                </ul>
                              </div>
                              <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Gasto real
                                </p>
                                <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                                  {project.actuals
                                    .filter((entry) => entry.category === row.category)
                                    .sort((a, b) => (a.date < b.date ? 1 : -1))
                                    .map((entry) => (
                                      <li key={entry.id} className="flex justify-between gap-3 text-xs">
                                        <span className="min-w-0 truncate">
                                          {entry.concept}
                                          <span className="text-muted-foreground">
                                            {" "}
                                            · {formatDate(entry.date)} ·{" "}
                                            {SOURCE_LABELS[entry.source] ?? entry.source}
                                            {entry.reference ? ` (${entry.reference})` : ""}
                                          </span>
                                        </span>
                                        <span className="tabular-nums">{formatCurrency(entry.amount)}</span>
                                      </li>
                                    ))}
                                  {project.actuals.filter((entry) => entry.category === row.category)
                                    .length === 0 && (
                                    <li className="text-xs text-muted-foreground">
                                      Sin gasto registrado en esta partida.
                                    </li>
                                  )}
                                </ul>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-border bg-muted/40 text-sm font-semibold">
                <tr>
                  <td className="px-5 py-3">Total</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {formatCurrency(project.totals.budget_total)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(project.totals.earned_budget)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {formatCurrency(project.totals.actual_total)}
                  </td>
                  <td
                    className={cn(
                      "px-5 py-3 text-right tabular-nums",
                      project.totals.variance > 0 ? "text-destructive" : "text-success",
                    )}
                  >
                    {project.totals.variance > 0 ? "+" : ""}
                    {formatCurrency(project.totals.variance)}
                  </td>
                  <td className="px-5 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Editor del presupuesto base */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Presupuesto base · {project.folio}</DialogTitle>
            <DialogDescription>
              Las partidas son las mismas para las tres áreas: mano de obra, materiales,
              herramienta y equipo, gastos operativos e indirectos. [R-03]
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-2">
            {lines.map((line, index) => (
              <div key={line.key} className="grid gap-2 sm:grid-cols-[1.2fr_1.6fr_0.7fr_0.6fr_0.8fr_auto]">
                <SelectField
                  value={line.category}
                  onChange={(value) =>
                    setLines((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, category: value as CostCategory } : row,
                      ),
                    )
                  }
                  items={CATEGORY_ITEMS}
                />
                <Input
                  value={line.concept}
                  placeholder="Concepto"
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, concept: event.target.value } : row,
                      ),
                    )
                  }
                />
                <Input
                  value={line.unit}
                  placeholder="Unidad"
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, unit: event.target.value } : row,
                      ),
                    )
                  }
                />
                <Input
                  type="number"
                  value={line.qty}
                  placeholder="Cant."
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, qty: event.target.value } : row,
                      ),
                    )
                  }
                />
                <Input
                  type="number"
                  value={line.unit_cost}
                  placeholder="Costo unit."
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, unit_cost: event.target.value } : row,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setLines((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  {
                    key: `new-${Date.now()}`,
                    category: "materiales",
                    concept: "",
                    unit: "lote",
                    qty: "1",
                    unit_cost: "0",
                  },
                ])
              }
            >
              <Plus className="size-4" />
              Agregar partida
            </Button>

            <p className="mt-2 text-right text-sm font-semibold">
              Total presupuestado: {formatCurrency(draftTotal)}
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveBudget.mutate()} disabled={saveBudget.isPending}>
              {saveBudget.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Guardar presupuesto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Captura manual de gasto real */}
      <Dialog open={spendOpen} onOpenChange={setSpendOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar gasto real</DialogTitle>
            <DialogDescription>
              Para compras usa el módulo de Compras y para gastos de cuadrilla el registro de
              campo: así no se captura dos veces. [R-24]
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Partida</Label>
              <SelectField
                value={spend.category}
                onChange={(value) => setSpend((current) => ({ ...current, category: value as CostCategory }))}
                items={CATEGORY_ITEMS}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Concepto</Label>
              <Input
                value={spend.concept}
                onChange={(event) => setSpend((current) => ({ ...current, concept: event.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Importe</Label>
                <Input
                  type="number"
                  value={spend.amount}
                  onChange={(event) => setSpend((current) => ({ ...current, amount: event.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={spend.date}
                  onChange={(event) => setSpend((current) => ({ ...current, date: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Referencia (opcional)</Label>
              <Input
                value={spend.reference}
                onChange={(event) => setSpend((current) => ({ ...current, reference: event.target.value }))}
                placeholder="Folio, vale, nota…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSpendOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => addSpend.mutate()} disabled={addSpend.isPending}>
              {addSpend.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
