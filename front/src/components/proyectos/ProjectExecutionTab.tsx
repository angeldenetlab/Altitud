"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, ImageIcon, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { SelectField } from "@/components/data/SelectField";
import { EXTRA_KIND, StatusBadge } from "@/components/data/StatusBadge";
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
import { Textarea } from "@/components/ui/textarea";
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

/** Colores del marcador de evidencia (DEMO-ONLY: sustituye a la foto real). */
const PLACEHOLDER_TONES: Record<string, string> = {
  "altura-1": "from-sky-500/30 to-sky-900/40",
  "altura-2": "from-cyan-500/30 to-teal-900/40",
  "limpieza-1": "from-emerald-500/30 to-emerald-900/40",
  "obra-1": "from-amber-500/30 to-orange-900/40",
  "obra-2": "from-orange-500/30 to-amber-900/40",
};

/** Avance por fase, extras/faltantes y evidencias. [R-05] [R-06] [R-26] [R-28] */
export function ProjectExecutionTab({
  project,
  canWrite,
}: {
  project: ProjectRow;
  canWrite: boolean;
}) {
  const queryClient = useQueryClient();
  const [extraOpen, setExtraOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [extra, setExtra] = useState({
    kind: "extra",
    category: "materiales" as CostCategory,
    concept: "",
    amount: "",
    billable: "si",
  });
  const [evidence, setEvidence] = useState({ title: "", phase: "", note: "" });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project", project.id] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const setPhase = useMutation({
    mutationFn: (input: { phase_id: number; progress: number }) =>
      projectsService.setPhase({ id: project.id, ...input }),
    onSuccess: () => invalidate(),
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "No se pudo actualizar el avance"),
  });

  const addExtra = useMutation({
    mutationFn: () =>
      projectsService.addExtra({
        id: project.id,
        kind: extra.kind,
        category: extra.category,
        concept: extra.concept,
        amount: Number(extra.amount || 0),
        billable: extra.billable === "si",
      }),
    onSuccess: () => {
      toast.success(extra.kind === "extra" ? "Extra registrado" : "Faltante registrado");
      setExtraOpen(false);
      setExtra((current) => ({ ...current, concept: "", amount: "" }));
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "No se pudo registrar"),
  });

  const addEvidence = useMutation({
    mutationFn: () =>
      projectsService.addEvidence({
        id: project.id,
        title: evidence.title,
        phase: evidence.phase || undefined,
        note: evidence.note || undefined,
        placeholder: Object.keys(PLACEHOLDER_TONES)[project.evidence.length % 5],
      }),
    onSuccess: () => {
      toast.success("Evidencia agregada");
      setEvidenceOpen(false);
      setEvidence({ title: "", phase: "", note: "" });
      invalidate();
    },
  });

  const extrasTotal = project.extras
    .filter((row) => row.kind === "extra")
    .reduce((acc, row) => acc + row.amount, 0);
  const faltantesTotal = project.extras
    .filter((row) => row.kind === "faltante")
    .reduce((acc, row) => acc + row.amount, 0);
  // Extras cobrables que todavía no se le han cotizado al cliente. [R-06] [R-09]
  const pendingToQuote = project.extras
    .filter((row) => row.kind === "extra" && row.billable && !row.quote_folio)
    .reduce((acc, row) => acc + row.amount, 0);

  return (
    <div className="grid gap-6">
      {/* Fases y avance */}
      <Card>
        <CardHeader>
          <CardTitle>Avance por fase</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {project.phases.map((phase) => (
            <div key={phase.id} className="grid gap-2 rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{phase.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Peso {phase.weight}% · {phase.assignee ?? "Sin responsable"}
                    {phase.due_date ? ` · vence ${formatDate(phase.due_date)}` : ""}
                    {phase.done_date ? ` · terminada ${formatDate(phase.done_date)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-12 text-right text-sm font-semibold tabular-nums">
                    {phase.progress}%
                  </span>
                  {canWrite && (
                    <>
                      {[25, 50, 75, 100].map((value) => (
                        <Button
                          key={value}
                          size="sm"
                          variant={phase.progress === value ? "secondary" : "ghost"}
                          onClick={() => setPhase.mutate({ phase_id: phase.id, progress: value })}
                          disabled={setPhase.isPending}
                        >
                          {value === 100 ? <Check className="size-4" /> : `${value}%`}
                        </Button>
                      ))}
                    </>
                  )}
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", phase.progress >= 100 ? "bg-success" : "bg-primary")}
                  style={{ width: `${phase.progress}%` }}
                />
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-sm">
            <span className="font-medium">Avance ponderado del proyecto</span>
            <span className="font-heading text-lg font-bold">{project.totals.progress}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Extras y faltantes */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Extras y faltantes</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Lo que se ocupó de más y lo que no se contempló. Los extras cobrables se le
              cotizan al cliente con <span className="font-medium">Cotizar al cliente</span>.
              [R-06]
            </p>
          </div>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => setExtraOpen(true)}>
              <Plus className="size-4" />
              Registrar
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">Extras (cobrables y no cobrables)</p>
              <p className="font-heading text-lg font-bold text-accent-foreground">
                {formatCurrency(extrasTotal)}
              </p>
              {pendingToQuote > 0 ? (
                <p className="mt-0.5 text-[11px] text-primary">
                  {formatCurrency(pendingToQuote)} sin cotizar al cliente
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">Faltantes (pegan al costo)</p>
              <p className="font-heading text-lg font-bold text-destructive">
                {formatCurrency(faltantesTotal)}
              </p>
            </div>
          </div>

          {project.extras.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
              Sin extras ni faltantes registrados.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {project.extras.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={row.kind} map={EXTRA_KIND} />
                      <p className="text-sm font-medium">{row.concept}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {CATEGORY_LABELS[row.category]} · {formatDate(row.date)}
                      {row.billable ? " · cobrable al cliente" : " · no cobrable"}
                      {row.approved_by ? ` · autorizó ${row.approved_by}` : ""}
                      {row.quote_folio ? ` · cotizado en ${row.quote_folio}` : ""}
                    </p>
                  </div>
                  <span className="tabular-nums font-semibold">{formatCurrency(row.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Evidencias */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Evidencia fotográfica</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Subida desde el sitio por el supervisor. [R-26]
            </p>
          </div>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => setEvidenceOpen(true)}>
              <Camera className="size-4" />
              Agregar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {project.evidence.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
              Todavía no hay fotos del proyecto.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {project.evidence.map((item) => (
                <figure key={item.id} className="overflow-hidden rounded-xl border border-border">
                  <div
                    className={cn(
                      "flex h-32 items-center justify-center bg-gradient-to-br",
                      PLACEHOLDER_TONES[item.placeholder] ?? "from-slate-500/30 to-slate-900/40",
                    )}
                  >
                    <ImageIcon className="size-8 text-white/70" />
                  </div>
                  <figcaption className="px-3 py-2">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.phase ? `${item.phase} · ` : ""}
                      {formatDate(item.date)} · {item.author}
                    </p>
                    {item.note && <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de extra / faltante */}
      <Dialog open={extraOpen} onOpenChange={setExtraOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Extra o faltante</DialogTitle>
            <DialogDescription>
              Un extra cobrable sube lo facturable; un faltante sube el costo real.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <SelectField
                  value={extra.kind}
                  onChange={(value) => setExtra((current) => ({ ...current, kind: value }))}
                  items={[
                    { value: "extra", label: "Extra (se ocupó de más)" },
                    { value: "faltante", label: "Faltante (no se contempló)" },
                  ]}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Partida</Label>
                <SelectField
                  value={extra.category}
                  onChange={(value) =>
                    setExtra((current) => ({ ...current, category: value as CostCategory }))
                  }
                  items={CATEGORY_ITEMS}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Concepto</Label>
              <Input
                value={extra.concept}
                onChange={(event) => setExtra((current) => ({ ...current, concept: event.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Importe</Label>
                <Input
                  type="number"
                  value={extra.amount}
                  onChange={(event) => setExtra((current) => ({ ...current, amount: event.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>¿Se le cobra al cliente?</Label>
                <SelectField
                  value={extra.billable}
                  onChange={(value) => setExtra((current) => ({ ...current, billable: value }))}
                  items={[
                    { value: "si", label: "Sí, cobrable" },
                    { value: "no", label: "No, lo absorbemos" },
                  ]}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setExtraOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => addExtra.mutate()} disabled={addExtra.isPending}>
              {addExtra.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de evidencia */}
      <Dialog open={evidenceOpen} onOpenChange={setEvidenceOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar evidencia</DialogTitle>
            <DialogDescription>
              DEMO: se guarda el registro con un marcador. Con el ERP conectado aquí se sube
              la foto tomada en sitio.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Título</Label>
              <Input
                value={evidence.title}
                onChange={(event) => setEvidence((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ej. Avance de fachada norte"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Fase</Label>
              <SelectField
                value={evidence.phase}
                onChange={(value) => setEvidence((current) => ({ ...current, phase: value }))}
                items={project.phases.map((phase) => ({ value: phase.name, label: phase.name }))}
                placeholder="Selecciona la fase"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Nota</Label>
              <Textarea
                value={evidence.note}
                onChange={(event) => setEvidence((current) => ({ ...current, note: event.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEvidenceOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => addEvidence.mutate()}
              disabled={!evidence.title.trim() || addEvidence.isPending}
            >
              {addEvidence.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
