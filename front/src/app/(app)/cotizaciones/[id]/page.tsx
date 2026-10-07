"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  Camera,
  CheckCircle2,
  Loader2,
  Plus,
  Printer,
  Ruler,
  Send,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ActividadesPanel } from "@/components/bitacora/ActividadesPanel";
import { Bitacora } from "@/components/bitacora/Bitacora";
import { SelectField } from "@/components/data/SelectField";
import { AREA_STATUS, QUOTE_STATUS, StatusBadge } from "@/components/data/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { canPerform } from "@/lib/auth/rbac";
import { formatCurrency, formatDate } from "@/lib/format";
import { AREA_LABELS, COMPANY_SHORT, QUOTE_STATUS_LABELS } from "@/lib/labels";
import { quotesService } from "@/services/quotesService";
import type { QuoteLine } from "@/types/altitude";

type DraftLine = {
  key: string;
  id?: number;
  service_id: string;
  qty: string;
  price_unit: string;
};

/**
 * Armado de la cotización: paramétricos por servicio, jornales calculados y el
 * flujo de autorización. [R-10] [R-12] [R-13] [R-14]
 */
export default function CotizacionDetallePage() {
  const { id } = useParams<{ id: string }>();
  const quoteId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const canWrite = session ? canPerform(session.role, "cotizaciones.write") : false;
  const canApprove = session ? canPerform(session.role, "cotizaciones.approve") : false;

  const query = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: () => quotesService.get(quoteId),
    enabled: Number.isFinite(quoteId),
  });
  const services = useQuery({ queryKey: ["services"], queryFn: () => quotesService.services() });

  // El borrador arranca del servidor y solo se separa cuando el usuario edita.
  const [draft, setDraft] = useState<{ lines: DraftLine[]; overhead: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const quote = query.data;
    if (!quote || dirty) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza el borrador con lo que devolvió el servidor
    setDraft({
      lines: quote.lines.map((line: QuoteLine) => ({
        key: `line-${line.id}`,
        id: line.id,
        service_id: String(line.service_id),
        qty: String(line.qty),
        price_unit: String(line.price_unit),
      })),
      overhead: String(quote.overhead_pct),
    });
  }, [query.data, dirty]);

  const lines = draft?.lines ?? [];
  const overhead = draft?.overhead ?? "22";

  function setLines(updater: (current: DraftLine[]) => DraftLine[]) {
    setDraft((current) => (current ? { ...current, lines: updater(current.lines) } : current));
  }

  function setOverhead(value: string) {
    setDraft((current) => (current ? { ...current, overhead: value } : current));
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
    queryClient.invalidateQueries({ queryKey: ["quotes"] });
    queryClient.invalidateQueries({ queryKey: ["chatter", "quote", quoteId] });
  };

  const save = useMutation({
    mutationFn: () =>
      quotesService.saveLines(
        quoteId,
        lines
          .filter((line) => line.service_id)
          .map((line) => ({
            id: line.id,
            service_id: Number(line.service_id),
            qty: Number(line.qty || 0),
            price_unit: Number(line.price_unit || 0),
          })),
        Number(overhead || 0),
      ),
    onSuccess: () => {
      toast.success("Costeo guardado");
      setDirty(false);
      invalidate();
    },
  });

  const setStatus = useMutation({
    mutationFn: (status: "vobo_socio" | "enviada" | "calculo") =>
      quotesService.setStatus(quoteId, status),
    onSuccess: (quote) => {
      toast.success(QUOTE_STATUS_LABELS[quote.status]);
      invalidate();
    },
  });

  const authorize = useMutation({
    mutationFn: () => quotesService.authorize({ id: quoteId, user: session?.name }),
    onSuccess: (result) => {
      toast.success(
        query.data?.origin === "levantamiento"
          ? `Autorizada · el proyecto ${result.project_folio} queda con presupuesto y precio`
          : query.data?.origin
            ? `Autorizada · se suma al proyecto ${result.project_folio}`
            : `Autorizada · proyecto ${result.project_folio} creado`,
      );
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      router.push(`/proyectos/${result.project_id}`);
    },
  });

  const reject = useMutation({
    mutationFn: () => quotesService.reject(quoteId, "No autorizada por el cliente"),
    onSuccess: () => {
      toast.success("Marcada como no autorizada");
      invalidate();
    },
  });

  const survey = useMutation({
    mutationFn: () =>
      quotesService.saveSurvey({
        id: quoteId,
        done_by: session?.name,
        measurements: [
          { label: "Área medida", value: Number(lines[0]?.qty ?? 0), unit: "m²" },
        ],
        photos: [{ title: "Foto de levantamiento", placeholder: "altura-1" }],
        notes: "Levantamiento capturado desde el celular.",
      }),
    onSuccess: () => {
      toast.success("Levantamiento guardado");
      invalidate();
    },
  });

  if (query.isLoading) return <Skeleton className="h-96 w-full" />;

  const quote = query.data;
  if (!quote) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">No se encontró la cotización.</p>
        <Link href="/cotizaciones" className="mt-3 inline-block text-sm text-primary hover:underline">
          Volver a cotizaciones
        </Link>
      </div>
    );
  }

  const serviceItems = (services.data?.rows ?? []).map((service) => ({
    value: String(service.id),
    label: `[${service.code}] ${service.name} · ${formatCurrency(service.price_unit)}/${service.unit}`,
  }));

  const draftTotals = lines.reduce(
    (acc, line) => {
      const service = services.data?.rows.find((row) => row.id === Number(line.service_id));
      const qty = Number(line.qty || 0);
      const price = Number(line.price_unit || service?.price_unit || 0);
      acc.amount += qty * price;
      acc.cost += qty * (service?.cost_unit ?? 0);
      acc.jornales += service ? qty / (service.yield_per_jornal || 1) : 0;
      return acc;
    },
    { amount: 0, cost: 0, jornales: 0 },
  );
  const draftCostWithOverhead = draftTotals.cost * (1 + Number(overhead || 0) / 100);
  const draftMargin =
    draftTotals.amount > 0
      ? Math.round(((draftTotals.amount - draftCostWithOverhead) / draftTotals.amount) * 100)
      : 0;

  const editable = canWrite && !["autorizada", "no_autorizada"].includes(quote.status);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link
            href="/cotizaciones"
            className="mt-1 flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-primary">{quote.folio}</span>
              <StatusBadge status={quote.area} map={AREA_STATUS} />
              <StatusBadge status={quote.status} map={QUOTE_STATUS} />
            </div>
            <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight">{quote.name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {quote.client} · {COMPANY_SHORT[quote.company]} · {AREA_LABELS[quote.area]} · vigente
              hasta {formatDate(quote.valid_until)}
            </p>
            {quote.origin && quote.project_folio ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {quote.origin === "extras"
                  ? "Extras de obra del proyecto"
                  : quote.origin === "adicional"
                    ? "Trabajo adicional del proyecto"
                    : quote.origin === "levantamiento"
                      ? "Desde el levantamiento"
                      : "Cotización inicial del proyecto"}{" "}
                <Link
                  href={`/proyectos/${quote.project_id}`}
                  className="font-mono font-semibold text-primary hover:underline"
                >
                  {quote.project_folio}
                </Link>
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* [R-14] DEMO-ONLY: el PDF se muestra con la vista de impresión del navegador.
              TODO(Odoo): reporte QWeb del pedido de venta. */}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            PDF
          </Button>
          {editable && quote.status === "calculo" && (
            <Button size="sm" variant="outline" onClick={() => setStatus.mutate("vobo_socio")}>
              <ThumbsUp className="size-4" />
              Pedir VoBo
            </Button>
          )}
          {editable && quote.status === "vobo_socio" && canApprove && (
            <Button size="sm" variant="outline" onClick={() => setStatus.mutate("enviada")}>
              <Send className="size-4" />
              Enviar al cliente
            </Button>
          )}
          {editable && ["enviada", "vobo_socio"].includes(quote.status) && canApprove && (
            <>
              <Button size="sm" onClick={() => authorize.mutate()} disabled={authorize.isPending}>
                {authorize.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {quote.origin === "levantamiento"
                  ? "Autorizar y llenar proyecto"
                  : quote.origin
                    ? "Autorizar (suma al proyecto)"
                    : "Autorizar y generar proyecto"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => reject.mutate()}>
                <Ban className="size-4" />
                No autorizada
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Costeo por servicio</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Precio estándar por unidad del catálogo; los jornales se calculan con el
                  rendimiento. [R-10] [R-12]
                </p>
              </div>
              {editable && (
                <Button size="sm" variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Guardar costeo
                </Button>
              )}
            </CardHeader>
            <CardContent className="grid gap-3">
              {lines.map((line, index) => {
                const service = services.data?.rows.find((row) => row.id === Number(line.service_id));
                const qty = Number(line.qty || 0);
                const price = Number(line.price_unit || 0);
                return (
                  <div
                    key={line.key}
                    className="grid items-end gap-2 rounded-xl border border-border p-3 sm:grid-cols-[2.2fr_0.8fr_0.9fr_0.7fr_0.9fr_auto]"
                  >
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Servicio</Label>
                      <SelectField
                        value={line.service_id}
                        onChange={(value) => {
                          const picked = services.data?.rows.find((row) => row.id === Number(value));
                          setDirty(true);
                          setLines((current) =>
                            current.map((row, rowIndex) =>
                              rowIndex === index
                                ? {
                                    ...row,
                                    service_id: value,
                                    price_unit: String(picked?.price_unit ?? row.price_unit),
                                  }
                                : row,
                            ),
                          );
                        }}
                        items={serviceItems}
                        disabled={!editable}
                        placeholder="Selecciona el servicio"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Cantidad {service ? `(${service.unit})` : ""}</Label>
                      <Input
                        type="number"
                        value={line.qty}
                        disabled={!editable}
                        onChange={(event) => {
                          setDirty(true);
                          setLines((current) =>
                            current.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, qty: event.target.value } : row,
                            ),
                          );
                        }}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Precio unitario</Label>
                      <Input
                        type="number"
                        value={line.price_unit}
                        disabled={!editable}
                        onChange={(event) => {
                          setDirty(true);
                          setLines((current) =>
                            current.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, price_unit: event.target.value } : row,
                            ),
                          );
                        }}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Jornales</Label>
                      <p className="h-9 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm tabular-nums">
                        {service ? Math.round((qty / (service.yield_per_jornal || 1)) * 10) / 10 : 0}
                      </p>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Importe</Label>
                      <p className="h-9 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-medium tabular-nums">
                        {formatCurrency(qty * price)}
                      </p>
                    </div>
                    {editable && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDirty(true);
                          setLines((current) => current.filter((_, rowIndex) => rowIndex !== index));
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                );
              })}

              {editable && (
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => {
                    setDirty(true);
                    setLines((current) => [
                      ...current,
                      { key: `new-${Date.now()}`, service_id: "", qty: "0", price_unit: "0" },
                    ]);
                  }}
                >
                  <Plus className="size-4" />
                  Agregar partida
                </Button>
              )}

              <div className="grid gap-3 rounded-xl bg-muted/50 p-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Importe al cliente</p>
                  <p className="font-heading text-lg font-bold">{formatCurrency(draftTotals.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Costo + indirectos</p>
                  <p className="font-heading text-lg font-bold">{formatCurrency(draftCostWithOverhead)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Jornales estimados</p>
                  <p className="font-heading text-lg font-bold">
                    {Math.round(draftTotals.jornales * 10) / 10}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Margen</p>
                  <p
                    className={`font-heading text-lg font-bold ${
                      draftMargin < 20 ? "text-destructive" : "text-success"
                    }`}
                  >
                    {draftMargin}%
                  </p>
                </div>
              </div>

              <div className="flex items-end gap-3">
                <div className="grid w-40 gap-1.5">
                  <Label className="text-xs">Indirectos %</Label>
                  <Input
                    type="number"
                    value={overhead}
                    disabled={!editable}
                    onChange={(event) => {
                      setDirty(true);
                      setOverhead(event.target.value);
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Se aplica sobre el costo directo del catálogo para llegar al costo total.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Levantamiento</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Lo puede hacer cualquiera con el celular: fotos y medidas. [R-11]
                </p>
              </div>
              {editable && (
                <Button size="sm" variant="outline" onClick={() => survey.mutate()}>
                  <Ruler className="size-4" />
                  {quote.survey ? "Actualizar" : "Capturar"}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!quote.survey ? (
                <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                  Sin levantamiento capturado.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {quote.survey.done_by} · {formatDate(quote.survey.date)}
                    </p>
                    <ul className="mt-2 flex flex-col gap-1">
                      {quote.survey.measurements.map((measure, index) => (
                        <li key={index} className="flex justify-between text-sm">
                          <span>{measure.label}</span>
                          <span className="tabular-nums">
                            {measure.value} {measure.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {quote.survey.notes && (
                      <p className="mt-2 text-xs text-muted-foreground">{quote.survey.notes}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quote.survey.photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="flex size-24 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-gradient-to-br from-primary/20 to-primary/5 text-[10px] text-muted-foreground"
                      >
                        <Camera className="size-5" />
                        <span className="px-1 text-center leading-tight">{photo.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Flujo de autorización</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-2">
                {quote.approvals.map((step, index) => (
                  <li key={index} className="flex items-center gap-3 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      {index + 1}
                    </span>
                    <span className="font-medium">{QUOTE_STATUS_LABELS[step.step]}</span>
                    <span className="text-muted-foreground">
                      {step.user} · {formatDate(step.date)}
                    </span>
                    {step.comment && (
                      <span className="text-xs text-muted-foreground">— {step.comment}</span>
                    )}
                  </li>
                ))}
              </ol>
              {quote.project_folio &&
                (quote.origin === "levantamiento" ? (
                  <p className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
                    Al autorizarse se llena el proyecto {quote.project_folio} con presupuesto y
                    precio de venta; no se abre otro registro.
                  </p>
                ) : quote.origin ? (
                  <p className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
                    Al autorizarse se suma a lo cobrable del proyecto {quote.project_folio}; no se
                    abre un proyecto nuevo.
                  </p>
                ) : (
                  <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
                    Generó el proyecto {quote.project_folio} con su presupuesto base.
                  </p>
                ))}
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6 print:hidden">
          <Card>
            <CardContent className="py-4">
              <ActividadesPanel model="quote" resId={quote.id} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <Bitacora model="quote" resId={quote.id} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
