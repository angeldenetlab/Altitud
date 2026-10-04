"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  ClipboardCheck,
  FileText,
  FolderKanban,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { ActividadesPanel } from "@/components/bitacora/ActividadesPanel";
import { Bitacora } from "@/components/bitacora/Bitacora";
import { DataTable, type DataTableColumn } from "@/components/data/DataTable";
import {
  AREA_STATUS,
  PROJECT_STAGE,
  QUOTE_STATUS,
  StatusBadge,
} from "@/components/data/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/format";
import { COMPANY_LABELS, STAGE_LABELS } from "@/lib/labels";
import { clientsService } from "@/services/clientsService";
import type { ClientDetail } from "@/types/altitude";

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
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

/** Ficha del cliente con cotizaciones, órdenes y proyectos ligados. */
export default function ClienteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id);

  const query = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => clientsService.get(clientId),
    enabled: Number.isFinite(clientId),
  });

  const client = query.data;

  const quoteColumns: DataTableColumn<ClientDetail["quotes"][number]>[] = [
    {
      key: "folio",
      header: "Folio",
      render: (row) => (
        <Link href={`/cotizaciones/${row.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
          {row.folio}
        </Link>
      ),
    },
    { key: "name", header: "Trabajo", render: (row) => row.name },
    { key: "status", header: "Estatus", render: (row) => <StatusBadge status={row.status} map={QUOTE_STATUS} /> },
    {
      key: "amount",
      header: "Importe",
      className: "text-right",
      render: (row) => <span className="tabular-nums font-medium">{formatCurrency(row.amount_total)}</span>,
    },
    { key: "date", header: "Fecha", render: (row) => formatDate(row.date) },
  ];

  const orderColumns: DataTableColumn<ClientDetail["orders"][number]>[] = [
    {
      key: "folio",
      header: "Folio",
      render: (row) => (
        <Link href={`/cotizaciones/${row.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
          {row.folio}
        </Link>
      ),
    },
    { key: "name", header: "Trabajo", render: (row) => row.name },
    {
      key: "amount",
      header: "Importe",
      className: "text-right",
      render: (row) => <span className="tabular-nums font-medium">{formatCurrency(row.amount_total)}</span>,
    },
    {
      key: "project",
      header: "Proyecto",
      render: (row) =>
        row.project_folio ? (
          <span className="font-mono text-xs">{row.project_folio}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { key: "date", header: "Fecha", render: (row) => formatDate(row.date) },
  ];

  const projectColumns: DataTableColumn<ClientDetail["projects"][number]>[] = [
    {
      key: "folio",
      header: "Folio",
      render: (row) => (
        <Link href={`/proyectos/${row.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
          {row.folio}
        </Link>
      ),
    },
    { key: "name", header: "Proyecto", render: (row) => row.name },
    { key: "area", header: "Área", render: (row) => <StatusBadge status={row.area} map={AREA_STATUS} /> },
    { key: "stage", header: "Etapa", render: (row) => <StatusBadge status={row.stage} map={PROJECT_STAGE} /> },
    {
      key: "contract",
      header: "Cobrable",
      className: "text-right",
      render: (row) => <span className="tabular-nums">{formatCurrency(row.contract_amount)}</span>,
    },
  ];

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
        <p>No se encontró el cliente.</p>
        <Link href="/clientes" className="mt-3 inline-block text-sm text-primary hover:underline">
          Volver al directorio
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/clientes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Clientes
      </Link>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{client.folio}</p>
                <h1 className="font-heading text-2xl font-bold tracking-tight">{client.name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {COMPANY_LABELS[client.company]} · {client.active ? "Activo" : "Inactivo"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border bg-muted/30 px-3 py-2 text-center">
                  <p className="text-lg font-bold tabular-nums">{client.stats.quotes_count}</p>
                  <p className="text-[11px] text-muted-foreground">Cotizaciones</p>
                </div>
                <div className="rounded-xl border bg-muted/30 px-3 py-2 text-center">
                  <p className="text-lg font-bold tabular-nums">{client.stats.orders_count}</p>
                  <p className="text-[11px] text-muted-foreground">Órdenes</p>
                </div>
                <div className="rounded-xl border bg-muted/30 px-3 py-2 text-center">
                  <p className="text-lg font-bold tabular-nums">{client.stats.projects_count}</p>
                  <p className="text-[11px] text-muted-foreground">Proyectos</p>
                </div>
                <div className="rounded-xl border bg-muted/30 px-3 py-2 text-center">
                  <p className="text-lg font-bold tabular-nums">{client.stats.active_projects}</p>
                  <p className="text-[11px] text-muted-foreground">Activos</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-1 sm:grid-cols-2">
              <InfoRow icon={UserRound} label="Contacto" value={client.contact} />
              <InfoRow icon={Phone} label="Teléfono" value={client.phone} />
              <InfoRow icon={Mail} label="Correo" value={client.email} />
              <InfoRow icon={Building2} label="RFC" value={client.rfc} />
            </div>
            {client.notes ? (
              <p className="mt-4 rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                {client.notes}
              </p>
            ) : null}
          </div>

          <Tabs defaultValue="cotizaciones">
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="cotizaciones">
                <FileText className="size-3.5" />
                Cotizaciones ({client.quotes.length})
              </TabsTrigger>
              <TabsTrigger value="ordenes">
                <ClipboardCheck className="size-3.5" />
                Órdenes ({client.orders.length})
              </TabsTrigger>
              <TabsTrigger value="proyectos">
                <FolderKanban className="size-3.5" />
                Proyectos ({client.projects.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cotizaciones">
              <Card>
                <CardHeader>
                  <CardTitle>Cotizaciones del cliente</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <DataTable
                    columns={quoteColumns}
                    rows={client.quotes}
                    rowKey={(row) => row.id}
                    emptyMessage="Este cliente todavía no tiene cotizaciones."
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ordenes">
              <Card>
                <CardHeader>
                  <CardTitle>Órdenes de venta autorizadas</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <DataTable
                    columns={orderColumns}
                    rows={client.orders}
                    rowKey={(row) => row.id}
                    emptyMessage="Todavía no hay órdenes autorizadas para este cliente."
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="proyectos">
              <Card>
                <CardHeader>
                  <CardTitle>Proyectos ligados</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Etapas: {STAGE_LABELS.ejecucion}, {STAGE_LABELS.cerrado} y demás del kanban.
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <DataTable
                    columns={projectColumns}
                    rows={client.projects}
                    rowKey={(row) => row.id}
                    emptyMessage="Este cliente todavía no tiene proyectos."
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4">
          <ActividadesPanel model="client" resId={client.id} />
          <Bitacora model="client" resId={client.id} />
        </aside>
      </div>
    </div>
  );
}
