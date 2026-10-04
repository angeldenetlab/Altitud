"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeDollarSign, CheckCircle2, FileText, Search, Timer } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data/DataTable";
import { KpiCard } from "@/components/data/KpiCard";
import { PageHeader } from "@/components/data/PageHeader";
import { SelectField } from "@/components/data/SelectField";
import { AREA_STATUS, QUOTE_STATUS, StatusBadge } from "@/components/data/StatusBadge";
import { CreateQuoteDialog } from "@/components/cotizaciones/CreateQuoteDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { canPerform } from "@/lib/auth/rbac";
import { formatCurrency, formatDate } from "@/lib/format";
import { AREA_LABELS, QUOTE_STATUS_LABELS, QUOTE_STATUS_ORDER } from "@/lib/labels";
import { quotesService } from "@/services/quotesService";
import type { ProjectArea, Quote, QuoteStatus } from "@/types/altitude";

const STATUS_ITEMS = [
  { value: "todas", label: "Todos los estatus" },
  ...QUOTE_STATUS_ORDER.map((status) => ({ value: status, label: QUOTE_STATUS_LABELS[status] })),
];

const AREA_ITEMS = [
  { value: "todas", label: "Todas las áreas" },
  ...(Object.keys(AREA_LABELS) as ProjectArea[]).map((area) => ({
    value: area,
    label: AREA_LABELS[area],
  })),
];

/** Seguimiento de cotizaciones por folio y estatus. [R-09] [R-15] */
export default function CotizacionesPage() {
  const { session } = useAuth();
  const canWrite = session ? canPerform(session.role, "cotizaciones.write") : false;

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todas");
  const [area, setArea] = useState("todas");

  const query = useQuery({
    queryKey: ["quotes", search, status, area],
    queryFn: () =>
      quotesService.list({
        search,
        status: status as QuoteStatus | "todas",
        area: area as ProjectArea | "todas",
      }),
  });

  const columns: DataTableColumn<Quote>[] = [
    {
      key: "folio",
      header: "Folio",
      render: (row) => (
        <Link
          href={`/cotizaciones/${row.id}`}
          className="font-mono text-xs font-semibold text-primary hover:underline"
        >
          {row.folio}
        </Link>
      ),
    },
    {
      key: "name",
      header: "Trabajo",
      render: (row) => (
        <div className="min-w-0">
          <p className="max-w-72 truncate font-medium">{row.name}</p>
          <p className="truncate text-xs text-muted-foreground">{row.client}</p>
        </div>
      ),
    },
    { key: "area", header: "Área", render: (row) => <StatusBadge status={row.area} map={AREA_STATUS} /> },
    { key: "status", header: "Estatus", render: (row) => <StatusBadge status={row.status} map={QUOTE_STATUS} /> },
    { key: "owner", header: "Responsable", render: (row) => row.owner },
    {
      key: "jornales",
      header: "Jornales",
      className: "text-right",
      render: (row) => <span className="tabular-nums">{row.jornales_total}</span>,
    },
    {
      key: "amount",
      header: "Importe",
      className: "text-right",
      render: (row) => <span className="tabular-nums font-medium">{formatCurrency(row.amount_total)}</span>,
    },
    {
      key: "margin",
      header: "Margen",
      className: "text-right",
      render: (row) => {
        const margin = row.amount_total > 0
          ? Math.round(((row.amount_total - row.cost_total) / row.amount_total) * 100)
          : 0;
        return (
          <span className={`tabular-nums font-semibold ${margin < 20 ? "text-destructive" : "text-success"}`}>
            {margin}%
          </span>
        );
      },
    },
    { key: "date", header: "Fecha", render: (row) => formatDate(row.date) },
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
  ];

  return (
    <div>
      <PageHeader
        title="Cotizaciones"
        description="Levantamiento → cálculo → visto bueno del socio → envío. Todo con folio y en el sistema, no en el Excel de cada quien. [R-09] [R-13]"
        actions={
          canWrite ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" render={<Link href="/ordenes" />}>
                <CheckCircle2 className="size-4" />
                Órdenes autorizadas
              </Button>
              <CreateQuoteDialog owner={session?.name} />
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="En el tablero" value={query.data?.total ?? 0} icon={FileText} isLoading={query.isLoading} />
        <KpiCard label="En proceso" value={query.data?.pending ?? 0} icon={Timer} tone="warning" isLoading={query.isLoading} />
        <KpiCard label="Autorizadas" value={query.data?.authorized ?? 0} icon={CheckCircle2} tone="positive" isLoading={query.isLoading} />
        <KpiCard
          label="Monto en espera"
          value={formatCurrency(query.data?.amount_pending)}
          icon={BadgeDollarSign}
          isLoading={query.isLoading}
        />
      </div>

      <div className="my-5 flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Folio, cliente o responsable…"
            className="pl-8"
          />
        </div>
        <SelectField value={status} onChange={setStatus} items={STATUS_ITEMS} className="w-52" />
        <SelectField value={area} onChange={setArea} items={AREA_ITEMS} className="w-48" />
      </div>

      <DataTable
        columns={columns}
        rows={query.data?.rows ?? []}
        rowKey={(row) => row.id}
        isLoading={query.isLoading}
        emptyMessage="No hay cotizaciones que coincidan con los filtros."
      />
    </div>
  );
}
