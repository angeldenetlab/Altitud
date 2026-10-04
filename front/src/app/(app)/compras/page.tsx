"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BadgeDollarSign, Boxes, FileWarning, Receipt, Search } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "@/components/data/DataTable";
import { KpiCard } from "@/components/data/KpiCard";
import { PageHeader } from "@/components/data/PageHeader";
import { SelectField } from "@/components/data/SelectField";
import { PURCHASE_STATUS, StatusBadge } from "@/components/data/StatusBadge";
import { CreatePurchaseDialog } from "@/components/compras/CreatePurchaseDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { canPerform } from "@/lib/auth/rbac";
import { formatCurrency, formatDate } from "@/lib/format";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { purchasesService } from "@/services/purchasesService";
import type { CostCategory, Purchase } from "@/types/altitude";

const STATUS_ITEMS = [
  { value: "todas", label: "Todos los estatus" },
  { value: "sin_factura", label: "Sin factura" },
  { value: "por_pagar", label: "Por pagar" },
  { value: "pagada", label: "Pagada" },
];

const CATEGORY_ITEMS = [
  { value: "todas", label: "Todas las partidas" },
  ...CATEGORY_ORDER.map((category) => ({ value: category, label: CATEGORY_LABELS[category] })),
];

/** Compras por proyecto e insumos de limpieza. [R-23] [R-24] [R-25] */
export default function ComprasPage() {
  const { session } = useAuth();
  const canWrite = session ? canPerform(session.role, "compras.write") : false;
  const queryClient = useQueryClient();

  const [tab, setTab] = useState("compras");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todas");
  const [category, setCategory] = useState("todas");
  const [counts, setCounts] = useState<Record<number, string>>({});

  const query = useQuery({
    queryKey: ["purchases", search, status, category],
    queryFn: () =>
      purchasesService.list({
        search,
        status,
        category: category as CostCategory | "todas",
      }),
  });

  const supplies = useQuery({ queryKey: ["supplies"], queryFn: () => purchasesService.supplies() });

  const setStatusMutation = useMutation({
    mutationFn: (input: { id: number; status: string }) => purchasesService.setStatus(input),
    onSuccess: () => {
      toast.success("Estatus actualizado");
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
    },
  });

  const countSupply = useMutation({
    mutationFn: (input: { id: number; on_hand: number }) => purchasesService.countSupply(input),
    onSuccess: () => {
      toast.success("Conteo guardado");
      queryClient.invalidateQueries({ queryKey: ["supplies"] });
    },
  });

  const columns: DataTableColumn<Purchase>[] = [
    { key: "folio", header: "Folio", render: (row) => <span className="font-mono text-xs">{row.folio}</span> },
    { key: "date", header: "Fecha", render: (row) => formatDate(row.date) },
    { key: "supplier", header: "Proveedor", render: (row) => row.supplier },
    {
      key: "project",
      header: "Proyecto",
      render: (row) => (
        <Link
          href={`/proyectos/${row.project_id}`}
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.project_folio}
        </Link>
      ),
    },
    {
      key: "concept",
      header: "Concepto",
      render: (row) => (
        <div className="min-w-0">
          <p className="max-w-56 truncate">{row.concept}</p>
          <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[row.category]}</p>
        </div>
      ),
    },
    {
      key: "invoice",
      header: "Factura",
      render: (row) =>
        row.invoice_folio ? (
          <span className="text-xs">{row.invoice_folio}</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-accent-foreground">
            <FileWarning className="size-3.5" /> pendiente
          </span>
        ),
    },
    { key: "status", header: "Estatus", render: (row) => <StatusBadge status={row.status} map={PURCHASE_STATUS} /> },
    {
      key: "amount",
      header: "Importe",
      className: "text-right",
      render: (row) => <span className="tabular-nums font-medium">{formatCurrency(row.amount)}</span>,
    },
    {
      key: "actions",
      header: "",
      render: (row) =>
        canWrite && row.status !== "pagada" ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setStatusMutation.mutate({
                id: row.id,
                status: row.status === "sin_factura" ? "por_pagar" : "pagada",
              })
            }
          >
            {row.status === "sin_factura" ? "Marcar con factura" : "Marcar pagada"}
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Compras y materiales"
        description="Cada compra se carga a un proyecto y aparece de inmediato en su costo real. Se captura una sola vez. [R-24]"
        actions={canWrite ? <CreatePurchaseDialog requestedBy={session?.name} /> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Compras del filtro" value={query.data?.total ?? 0} icon={Receipt} isLoading={query.isLoading} />
        <KpiCard
          label="Importe"
          value={formatCurrency(query.data?.amount)}
          icon={BadgeDollarSign}
          isLoading={query.isLoading}
        />
        <KpiCard
          label="Por pagar"
          value={formatCurrency(query.data?.por_pagar)}
          icon={AlertCircle}
          tone="warning"
          isLoading={query.isLoading}
        />
        <KpiCard
          label="Insumos por reponer"
          value={supplies.data?.to_reorder ?? 0}
          icon={Boxes}
          tone={(supplies.data?.to_reorder ?? 0) > 0 ? "negative" : "positive"}
          isLoading={supplies.isLoading}
        />
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(String(value ?? "compras"))} className="mt-5">
        <TabsList className="mb-4">
          <TabsTrigger value="compras">Compras</TabsTrigger>
          <TabsTrigger value="insumos">Insumos</TabsTrigger>
        </TabsList>

        <TabsContent value="compras">
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-56 flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Folio, proveedor, proyecto…"
                className="pl-8"
              />
            </div>
            <SelectField value={status} onChange={setStatus} items={STATUS_ITEMS} className="w-44" />
            <SelectField value={category} onChange={setCategory} items={CATEGORY_ITEMS} className="w-52" />
          </div>

          <DataTable
            columns={columns}
            rows={query.data?.rows ?? []}
            rowKey={(row) => row.id}
            isLoading={query.isLoading}
            emptyMessage="No hay compras que coincidan con los filtros."
          />
        </TabsContent>

        <TabsContent value="insumos">
          <Card>
            <CardHeader>
              <CardTitle>Conteo de insumos</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Solo para saber cuándo reponer: no hay entradas y salidas ni almacén. [R-25]
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Insumo</th>
                      <th className="px-5 py-3">Unidad</th>
                      <th className="px-5 py-3 text-right">Existencia</th>
                      <th className="px-5 py-3 text-right">Mínimo</th>
                      <th className="px-5 py-3">Último conteo</th>
                      {canWrite && <th className="px-5 py-3">Actualizar</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(supplies.data?.rows ?? []).map((supply) => {
                      const low = supply.on_hand <= supply.reorder_point;
                      return (
                        <tr key={supply.id} className={cn(low && "bg-destructive/[0.04]")}>
                          <td className="px-5 py-2.5">
                            <p className="font-medium">{supply.name}</p>
                            <p className="font-mono text-xs text-muted-foreground">{supply.code}</p>
                          </td>
                          <td className="px-5 py-2.5 text-xs text-muted-foreground">{supply.unit}</td>
                          <td
                            className={cn(
                              "px-5 py-2.5 text-right tabular-nums font-semibold",
                              low && "text-destructive",
                            )}
                          >
                            {supply.on_hand}
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">
                            {supply.reorder_point}
                          </td>
                          <td className="px-5 py-2.5 text-xs text-muted-foreground">
                            {formatDate(supply.last_count)}
                          </td>
                          {canWrite && (
                            <td className="px-5 py-2.5">
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  className="h-8 w-20"
                                  value={counts[supply.id] ?? ""}
                                  placeholder={String(supply.on_hand)}
                                  onChange={(event) =>
                                    setCounts((current) => ({
                                      ...current,
                                      [supply.id]: event.target.value,
                                    }))
                                  }
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    countSupply.mutate({
                                      id: supply.id,
                                      on_hand: Number(counts[supply.id] ?? supply.on_hand),
                                    })
                                  }
                                >
                                  Guardar
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
