"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  FileText,
  MapPin,
  Receipt,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { ActividadesPanel } from "@/components/bitacora/ActividadesPanel";
import { Bitacora } from "@/components/bitacora/Bitacora";
import { SelectField } from "@/components/data/SelectField";
import {
  ATTENDANCE_STATUS,
  AREA_STATUS,
  PROJECT_STAGE,
  PURCHASE_STATUS,
  QUOTE_STATUS,
  SOURCE_STATUS,
  StatusBadge,
} from "@/components/data/StatusBadge";
import { GenerateQuoteDialog } from "@/components/proyectos/GenerateQuoteDialog";
import { ProjectCloseTab } from "@/components/proyectos/ProjectCloseTab";
import { ProjectCostTab } from "@/components/proyectos/ProjectCostTab";
import { ProjectExecutionTab } from "@/components/proyectos/ProjectExecutionTab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { canPerform } from "@/lib/auth/rbac";
import { formatCurrency, formatDate } from "@/lib/format";
import { CATEGORY_LABELS, COMPANY_LABELS, STAGE_LABELS, STAGE_ORDER } from "@/lib/labels";
import { attendanceService } from "@/services/attendanceService";
import { projectsService } from "@/services/projectsService";
import { purchasesService } from "@/services/purchasesService";
import type { ProjectStage } from "@/types/altitude";

const STAGE_ITEMS = [
  ...STAGE_ORDER.map((stage) => ({ value: stage, label: STAGE_LABELS[stage] })),
  { value: "perdido", label: STAGE_LABELS.perdido },
];

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="break-words text-sm font-medium">{value || "—"}</div>
      </div>
    </div>
  );
}

/** Ficha del proyecto: costeo, ejecución, compras, asistencias y cierre. */
export default function ProyectoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { session } = useAuth();
  const canWrite = session ? canPerform(session.role, "proyectos.write") : false;
  const canClose = session ? canPerform(session.role, "proyectos.close") : false;
  const canQuote = session ? canPerform(session.role, "cotizaciones.write") : false;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("resumen");

  const query = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsService.get(projectId),
    enabled: Number.isFinite(projectId),
  });

  const purchases = useQuery({
    queryKey: ["purchases", "project", projectId],
    queryFn: () => purchasesService.list({ project_id: projectId }),
    enabled: Number.isFinite(projectId),
  });

  const expenses = useQuery({
    queryKey: ["expenses", "project", projectId],
    queryFn: () => purchasesService.expenses(projectId),
    enabled: Number.isFinite(projectId),
  });

  const attendance = useQuery({
    queryKey: ["attendance", "project", projectId],
    queryFn: () => attendanceService.list({ project_id: projectId }),
    enabled: Number.isFinite(projectId),
  });

  const setStage = useMutation({
    mutationFn: (stage: ProjectStage) => projectsService.setStage(projectId, stage),
    onSuccess: (project) => {
      toast.success(`Etapa: ${STAGE_LABELS[project.stage]}`);
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["chatter", "project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  if (query.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const project = query.data;
  if (!project) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">No se encontró el proyecto.</p>
        <Link href="/proyectos" className="mt-3 inline-block text-sm text-primary hover:underline">
          Volver a proyectos
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link
            href="/proyectos"
            className="mt-1 flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-primary">{project.folio}</span>
              <StatusBadge status={project.area} map={AREA_STATUS} />
              <StatusBadge status={project.stage} map={PROJECT_STAGE} />
            </div>
            <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight">{project.name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {project.client}
              {project.quote_folio ? ` · desde ${project.quote_folio}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canQuote && <GenerateQuoteDialog project={project} owner={session?.name} />}
          {canWrite && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Etapa</span>
              <SelectField
                value={project.stage}
                onChange={(value) => setStage.mutate(value as ProjectStage)}
                items={STAGE_ITEMS}
                className="w-44"
              />
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Cobrable</p>
            <p className="font-heading text-xl font-bold">
              {formatCurrency(project.totals.billable_total)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Venta {formatCurrency(project.contract_amount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Presupuestado</p>
            <p className="font-heading text-xl font-bold">
              {formatCurrency(project.totals.budget_total)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Gasto real</p>
            <p
              className={`font-heading text-xl font-bold ${
                project.totals.variance > 0 ? "text-destructive" : ""
              }`}
            >
              {formatCurrency(project.totals.actual_total)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {project.totals.variance > 0 ? "+" : ""}
              {formatCurrency(project.totals.variance)} vs. lo esperado al {project.totals.progress}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Rentabilidad</p>
            <p
              className={`font-heading text-xl font-bold ${
                project.totals.margin_pct < 15 ? "text-destructive" : "text-success"
              }`}
            >
              {project.totals.margin_pct}%
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatCurrency(project.totals.margin_amount)} · costo al cierre{" "}
              {formatCurrency(project.totals.forecast_cost)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <Tabs value={tab} onValueChange={(value) => setTab(String(value ?? "resumen"))}>
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="costos">Presupuesto y gasto</TabsTrigger>
              <TabsTrigger value="ejecucion">Ejecución</TabsTrigger>
              <TabsTrigger value="compras">Compras y gastos</TabsTrigger>
              <TabsTrigger value="asistencias">Asistencias</TabsTrigger>
              <TabsTrigger value="cierre">Cierre</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen">
              <div className="grid gap-6 sm:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Datos del proyecto</CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y divide-border py-0">
                    <InfoRow icon={MapPin} label="Sitio" value={project.site} />
                    <InfoRow icon={Building2} label="Razón social" value={COMPANY_LABELS[project.company]} />
                    <InfoRow icon={UserRound} label="Supervisor" value={project.supervisor} />
                    <InfoRow icon={Users} label="Control de proyectos" value={project.coordinator} />
                    <InfoRow
                      icon={CalendarDays}
                      label="Periodo"
                      value={`${formatDate(project.start_date)} → ${
                        project.end_date ? formatDate(project.end_date) : "sin fecha"
                      }`}
                    />
                    {project.quote_folio && (
                      <InfoRow icon={FileText} label="Cotización" value={project.quote_folio} />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Avance por fase</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {project.phases.map((phase) => (
                      <div key={phase.id}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate">
                            {phase.name}
                            {phase.assignee ? (
                              <span className="font-normal text-muted-foreground">
                                {" "}
                                · {phase.assignee}
                              </span>
                            ) : null}
                          </span>
                          <span className="tabular-nums text-muted-foreground">{phase.progress}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${phase.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {project.notes && (
                      <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                        {project.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Cotizaciones del cliente ligadas al proyecto. [R-09] [R-15] */}
                <Card className="sm:col-span-2">
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle>Cotizaciones al cliente</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        La que originó el proyecto y las que se le han generado después por
                        extras o trabajo adicional.
                      </p>
                    </div>
                    {canQuote && <GenerateQuoteDialog project={project} owner={session?.name} />}
                  </CardHeader>
                  <CardContent className="p-0">
                    {project.quotes.length === 0 ? (
                      <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                        Este proyecto todavía no tiene cotización.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {project.quotes.map((quote) => (
                          <li
                            key={quote.id}
                            className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  href={`/cotizaciones/${quote.id}`}
                                  className="font-mono text-xs font-semibold text-primary hover:underline"
                                >
                                  {quote.folio}
                                </Link>
                                <StatusBadge status={quote.status} map={QUOTE_STATUS} />
                                <span className="text-xs text-muted-foreground">
                                  {quote.origin === "extras"
                                    ? "Extras de obra"
                                    : quote.origin === "adicional"
                                      ? "Trabajo adicional"
                                      : quote.origin === "inicial"
                                        ? "Cotización inicial"
                                        : "Originó el proyecto"}
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {formatDate(quote.date)}
                              </p>
                            </div>
                            <span className="tabular-nums font-semibold">
                              {formatCurrency(quote.amount_total)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="costos">
              <ProjectCostTab project={project} canWrite={canWrite} />
            </TabsContent>

            <TabsContent value="ejecucion">
              <ProjectExecutionTab project={project} canWrite={canWrite} />
            </TabsContent>

            <TabsContent value="compras">
              <div className="grid gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Compras cargadas al proyecto</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {(purchases.data?.rows.length ?? 0) === 0 ? (
                      <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                        Sin compras registradas.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <tr>
                              <th className="px-5 py-3">Folio</th>
                              <th className="px-5 py-3">Proveedor</th>
                              <th className="px-5 py-3">Partida</th>
                              <th className="px-5 py-3">Factura</th>
                              <th className="px-5 py-3">Estatus</th>
                              <th className="px-5 py-3 text-right">Importe</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {purchases.data?.rows.map((row) => (
                              <tr key={row.id}>
                                <td className="px-5 py-2.5 font-mono text-xs">{row.folio}</td>
                                <td className="px-5 py-2.5">{row.supplier}</td>
                                <td className="px-5 py-2.5 text-xs text-muted-foreground">
                                  {CATEGORY_LABELS[row.category]}
                                </td>
                                <td className="px-5 py-2.5 text-xs">{row.invoice_folio ?? "—"}</td>
                                <td className="px-5 py-2.5">
                                  <StatusBadge status={row.status} map={PURCHASE_STATUS} />
                                </td>
                                <td className="px-5 py-2.5 text-right tabular-nums">
                                  {formatCurrency(row.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="size-4 text-muted-foreground" />
                      Gastos capturados en campo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {(expenses.data?.rows.length ?? 0) === 0 ? (
                      <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                        Sin gastos de campo.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {expenses.data?.rows.map((row) => (
                          <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{row.concept}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(row.date)} · {row.captured_by} ·{" "}
                                {row.has_receipt ? "con comprobante" : "sin comprobante"}
                              </p>
                            </div>
                            <span className="tabular-nums">{formatCurrency(row.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="asistencias">
              <Card>
                <CardHeader>
                  <CardTitle>Asistencias del proyecto</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {attendance.data?.jornales ?? 0} jornales ·{" "}
                    {formatCurrency(attendance.data?.cost)} de mano de obra. El costo se calcula
                    solo, sin captura manual. [R-20]
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  {(attendance.data?.rows.length ?? 0) === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                      Sin asistencias registradas.
                    </p>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 border-b border-border bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-5 py-3">Fecha</th>
                            <th className="px-5 py-3">Colaborador</th>
                            <th className="px-5 py-3">Jornada</th>
                            <th className="px-5 py-3">Origen</th>
                            <th className="px-5 py-3 text-right">Costo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {attendance.data?.rows.map((row) => (
                            <tr key={row.id}>
                              <td className="px-5 py-2.5">{formatDate(row.date)}</td>
                              <td className="px-5 py-2.5">{row.employee_name}</td>
                              <td className="px-5 py-2.5">
                                <StatusBadge status={row.kind} map={ATTENDANCE_STATUS} />
                              </td>
                              <td className="px-5 py-2.5">
                                <StatusBadge status={row.source} map={SOURCE_STATUS} />
                              </td>
                              <td className="px-5 py-2.5 text-right tabular-nums">
                                {formatCurrency(row.cost)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cierre">
              <ProjectCloseTab project={project} canClose={canClose} />
            </TabsContent>
          </Tabs>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardContent className="py-4">
              <ActividadesPanel
                model="project"
                resId={project.id}
                invalidate={[["project", project.id]]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <Bitacora model="project" resId={project.id} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
