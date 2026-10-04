"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BadgeDollarSign, CheckCircle2, ClipboardCheck, FileText, Search } from "lucide-react";
import { CreateQuoteDialog } from "@/components/cotizaciones/CreateQuoteDialog";
import { DataTable, type DataTableColumn } from "@/components/data/DataTable";
import { KpiCard } from "@/components/data/KpiCard";
import { PageHeader } from "@/components/data/PageHeader";
import { SelectField } from "@/components/data/SelectField";
import { AREA_STATUS, StatusBadge } from "@/components/data/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { canPerform } from "@/lib/auth/rbac";
import { formatCurrency, formatDate } from "@/lib/format";
import { AREA_LABELS } from "@/lib/labels";
import { quotesService } from "@/services/quotesService";
import type { ProjectArea, Quote } from "@/types/altitude";

const AREA_ITEMS = [
  { value: "todas", label: "Todas las áreas" },
  ...(Object.keys(AREA_LABELS) as ProjectArea[]).map((area) => ({
    value: area,
    label: AREA_LABELS[area],
  })),
];

/** Órdenes de venta = cotizaciones autorizadas (pedido confirmado). */
export default function OrdenesPage() {
  const { session } = useAuth();
  const canWrite = session ? canPerform(session.role, "cotizaciones.write") : false;

  const [search, setSearch] = useState("");
  const [area, setArea] = useState("todas");

  const query = useQuery({
    queryKey: ["orders", search, area],
    queryFn: () =>
      quotesService.list({
        search,
        status: "autorizada",
        area: area as ProjectArea | "todas",
      }),
  });

  const rows = query.data?.rows ?? [];

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
    { key: "owner", header: "Responsable", render: (row) => row.owner },
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
    { key: "date", header: "Autorizada", render: (row) => formatDate(row.date) },
  ];

  const totalAmount = rows.reduce((sum, row) => sum + row.amount_total, 0);

  return (
    <div>
      <PageHeader
        title="Órdenes de venta"
        description="Pedidos confirmados: son las cotizaciones autorizadas por el socio, listas para ejecutar o ya ligadas a un proyecto."
        actions={
          canWrite ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" render={<Link href="/cotizaciones" />}>
                <FileText className="size-4" />
                Ver cotizaciones
              </Button>
              <CreateQuoteDialog owner={session?.name} />
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Órdenes activas" value={query.data?.authorized ?? 0} icon={ClipboardCheck} isLoading={query.isLoading} />
        <KpiCard label="En el tablero" value={query.data?.total ?? 0} icon={CheckCircle2} tone="positive" isLoading={query.isLoading} />
        <KpiCard
          label="Monto autorizado"
          value={formatCurrency(totalAmount)}
          icon={BadgeDollarSign}
          isLoading={query.isLoading}
        />
        <KpiCard
          label="Con proyecto"
          value={rows.filter((row) => Boolean(row.project_folio)).length}
          icon={FileText}
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
        <SelectField value={area} onChange={setArea} items={AREA_ITEMS} className="w-48" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={query.isLoading}
        emptyMessage="No hay órdenes de venta autorizadas que coincidan con los filtros."
      />
    </div>
  );
}
