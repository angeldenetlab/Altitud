"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SelectField } from "@/components/data/SelectField";
import { Button } from "@/components/ui/button";
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
import { CATEGORY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { quotesService } from "@/services/quotesService";
import type { CostCategory, ProjectRow, QuoteOrigin } from "@/types/altitude";

type DraftLine = { key: string; service_id: string; qty: string; price_unit: string };

/**
 * Generar una cotización para el cliente **desde el proyecto**. [R-06] [R-09]
 *
 * Es el camino inverso al de Cotizaciones: aquí el trabajo ya está en marcha y
 * hay que cobrarle algo nuevo al cliente sin abrir otro proyecto.
 */
export function GenerateQuoteDialog({
  project,
  owner,
}: {
  project: ProjectRow;
  owner?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<QuoteOrigin>(
    project.quote_folio ? "extras" : "inicial",
  );
  const [selectedExtras, setSelectedExtras] = useState<number[] | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([
    { key: "l1", service_id: "", qty: "0", price_unit: "0" },
  ]);
  const [amount, setAmount] = useState(String(project.contract_amount || ""));
  const [concept, setConcept] = useState(project.name);
  const [notes, setNotes] = useState("");
  const [overhead, setOverhead] = useState("22");

  const extras = useQuery({
    queryKey: ["quotes", "pendingExtras", project.id],
    queryFn: () => quotesService.pendingExtras(project.id),
    enabled: open,
  });
  const services = useQuery({
    queryKey: ["services"],
    queryFn: () => quotesService.services(),
    enabled: open,
  });

  const pendingExtras = extras.data?.rows ?? [];
  const chosenExtras = selectedExtras ?? pendingExtras.map((extra) => extra.id);
  const extrasTotal = pendingExtras
    .filter((extra) => chosenExtras.includes(extra.id))
    .reduce((acc, extra) => acc + extra.amount, 0);

  const serviceItems = (services.data?.rows ?? []).map((service) => ({
    value: String(service.id),
    label: `[${service.code}] ${service.name} · ${formatCurrency(service.price_unit)}/${service.unit}`,
  }));

  const additionalTotal = lines.reduce(
    (acc, line) => acc + Number(line.qty || 0) * Number(line.price_unit || 0),
    0,
  );

  const create = useMutation({
    mutationFn: () =>
      quotesService.createFromProject({
        project_id: project.id,
        origin,
        owner,
        notes: notes || undefined,
        overhead_pct: Number(overhead || 22),
        ...(origin === "extras" ? { extra_ids: chosenExtras } : {}),
        ...(origin === "inicial" ? { amount: Number(amount || 0), concept } : {}),
        ...(origin === "adicional"
          ? {
              lines: lines
                .filter((line) => line.service_id && Number(line.qty) > 0)
                .map((line) => ({
                  service_id: Number(line.service_id),
                  qty: Number(line.qty),
                  price_unit: Number(line.price_unit),
                })),
            }
          : {}),
      }),
    onSuccess: (quote) => {
      toast.success(`Cotización ${quote.folio} generada para ${quote.client}`);
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["chatter", "project", project.id] });
      setOpen(false);
      router.push(`/cotizaciones/${quote.id}`);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "No se pudo generar la cotización"),
  });

  const originItems = [
    ...(pendingExtras.length > 0 || origin === "extras"
      ? [{ value: "extras", label: "Extras de obra pendientes de cobrar" }]
      : []),
    { value: "adicional", label: "Trabajo adicional en el mismo sitio" },
    ...(!project.quote_folio ? [{ value: "inicial", label: "Cotización inicial del proyecto" }] : []),
  ];

  const total = origin === "extras" ? extrasTotal : origin === "adicional" ? additionalTotal : Number(amount || 0);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FilePlus2 className="size-4" />
        Cotizar al cliente
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cotizar al cliente · {project.folio}</DialogTitle>
            <DialogDescription>
              Se genera una cotización con folio propio, ligada a este proyecto. Al autorizarse
              no se abre otro proyecto: se suma a lo cobrable de este. [R-06] [R-09]
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Qué se le va a cotizar</Label>
              <SelectField
                value={origin}
                onChange={(value) => setOrigin(value as QuoteOrigin)}
                items={originItems}
              />
            </div>

            {origin === "extras" && (
              <div className="grid gap-2">
                <Label>Extras cobrables sin cotizar</Label>
                {pendingExtras.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                    No hay extras cobrables pendientes. Regístralos en la pestaña Ejecución del
                    proyecto y vuelve aquí.
                  </p>
                ) : (
                  <ul className="grid gap-1.5">
                    {pendingExtras.map((extra) => {
                      const checked = chosenExtras.includes(extra.id);
                      return (
                        <li key={extra.id}>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedExtras(
                                checked
                                  ? chosenExtras.filter((id) => id !== extra.id)
                                  : [...chosenExtras, extra.id],
                              )
                            }
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                              checked
                                ? "border-primary bg-primary/10"
                                : "border-border hover:bg-muted",
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{extra.concept}</span>
                              <span className="block text-xs text-muted-foreground">
                                {CATEGORY_LABELS[extra.category as CostCategory]} ·{" "}
                                {formatDate(extra.date)}
                              </span>
                            </span>
                            <span className="shrink-0 tabular-nums font-medium">
                              {formatCurrency(extra.amount)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {origin === "adicional" && (
              <div className="grid gap-2">
                <Label>Partidas del catálogo</Label>
                {lines.map((line, index) => (
                  <div key={line.key} className="grid gap-2 sm:grid-cols-[2.4fr_0.7fr_0.9fr_auto]">
                    <SelectField
                      value={line.service_id}
                      onChange={(value) => {
                        const service = services.data?.rows.find((row) => row.id === Number(value));
                        setLines((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index
                              ? {
                                  ...row,
                                  service_id: value,
                                  price_unit: String(service?.price_unit ?? row.price_unit),
                                }
                              : row,
                          ),
                        );
                      }}
                      items={serviceItems}
                      placeholder="Servicio"
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
                      value={line.price_unit}
                      placeholder="Precio"
                      onChange={(event) =>
                        setLines((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, price_unit: event.target.value } : row,
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setLines((current) => current.filter((_, rowIndex) => rowIndex !== index))
                      }
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
                      { key: `l${Date.now()}`, service_id: "", qty: "0", price_unit: "0" },
                    ])
                  }
                >
                  <Plus className="size-4" />
                  Agregar partida
                </Button>
              </div>
            )}

            {origin === "inicial" && (
              <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
                <div className="grid gap-1.5">
                  <Label>Concepto</Label>
                  <Input value={concept} onChange={(event) => setConcept(event.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Importe al cliente</Label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-[1fr_0.5fr]">
              <div className="grid gap-1.5">
                <Label>Notas para el cliente</Label>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
              </div>
              <div className="grid gap-1.5">
                <Label>Indirectos %</Label>
                <Input
                  type="number"
                  value={overhead}
                  onChange={(event) => setOverhead(event.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5">
              <span className="text-sm text-muted-foreground">Total a cotizar</span>
              <span className="font-heading text-lg font-bold">{formatCurrency(total)}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => create.mutate()} disabled={total <= 0 || create.isPending}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Generar cotización
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
