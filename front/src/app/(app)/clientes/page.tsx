"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, FolderKanban, Search, UserRound, Users } from "lucide-react";
import { CreateClientDialog } from "@/components/clientes/CreateClientDialog";
import { DataTable, type DataTableColumn } from "@/components/data/DataTable";
import { KpiCard } from "@/components/data/KpiCard";
import { PageHeader } from "@/components/data/PageHeader";
import { SelectField } from "@/components/data/SelectField";
import { StatusBadge } from "@/components/data/StatusBadge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { canPerform } from "@/lib/auth/rbac";
import { COMPANY_SHORT } from "@/lib/labels";
import { clientsService } from "@/services/clientsService";
import type { Client, CompanyCode } from "@/types/altitude";

const COMPANY_ITEMS = [
  { value: "todas", label: "Ambas razones sociales" },
  ...(Object.keys(COMPANY_SHORT) as CompanyCode[]).map((code) => ({
    value: code,
    label: COMPANY_SHORT[code],
  })),
];

const ACTIVE_ITEMS = [
  { value: "todos", label: "Todos los estatus" },
  { value: "activos", label: "Solo activos" },
  { value: "inactivos", label: "Solo inactivos" },
];

const CLIENT_STATUS = {
  active: { label: "Activo", tone: "emerald" as const },
  inactive: { label: "Inactivo", tone: "slate" as const },
};

/** Directorio de clientes con folio y enlace a cotizaciones, órdenes y proyectos. */
export default function ClientesPage() {
  const { session } = useAuth();
  const canWrite = session ? canPerform(session.role, "clientes.write") : false;

  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("todas");
  const [active, setActive] = useState("activos");

  const query = useQuery({
    queryKey: ["clients", search, company, active],
    queryFn: () =>
      clientsService.list({
        search,
        company: company as CompanyCode | "todas",
        active:
          active === "todos" ? "todos" : active === "activos" ? true : false,
      }),
  });

  const columns: DataTableColumn<Client>[] = [
    {
      key: "folio",
      header: "Folio",
      render: (row) => (
        <Link
          href={`/clientes/${row.id}`}
          className="font-mono text-xs font-semibold text-primary hover:underline"
        >
          {row.folio}
        </Link>
      ),
    },
    {
      key: "name",
      header: "Cliente",
      render: (row) => (
        <div className="min-w-0">
          <p className="max-w-72 truncate font-medium">{row.name}</p>
          <p className="truncate text-xs text-muted-foreground">{row.contact || "Sin contacto"}</p>
        </div>
      ),
    },
    {
      key: "company",
      header: "Factura con",
      render: (row) => COMPANY_SHORT[row.company],
    },
    {
      key: "phone",
      header: "Teléfono",
      render: (row) => row.phone || "—",
    },
    {
      key: "email",
      header: "Correo",
      render: (row) => (
        <span className="max-w-48 truncate text-xs text-muted-foreground">{row.email || "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Estatus",
      render: (row) => (
        <StatusBadge status={row.active ? "active" : "inactive"} map={CLIENT_STATUS} />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Catálogo central de clientes: de aquí salen cotizaciones, órdenes de venta y proyectos, sin capturar el nombre a mano en cada pantalla."
        actions={canWrite ? <CreateClientDialog /> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="En el directorio" value={query.data?.total ?? 0} icon={Users} isLoading={query.isLoading} />
        <KpiCard label="Activos" value={query.data?.active ?? 0} icon={UserRound} tone="positive" isLoading={query.isLoading} />
        <KpiCard
          label="Con proyecto activo"
          value={query.data?.with_active_projects ?? 0}
          icon={FolderKanban}
          tone="warning"
          isLoading={query.isLoading}
        />
        <KpiCard label="Razones sociales" value={2} icon={Building2} isLoading={query.isLoading} />
      </div>

      <div className="my-5 flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Folio, nombre, contacto o RFC…"
            className="pl-8"
          />
        </div>
        <SelectField value={company} onChange={setCompany} items={COMPANY_ITEMS} className="w-52" />
        <SelectField value={active} onChange={setActive} items={ACTIVE_ITEMS} className="w-44" />
      </div>

      <DataTable
        columns={columns}
        rows={query.data?.rows ?? []}
        rowKey={(row) => row.id}
        isLoading={query.isLoading}
        emptyMessage="No hay clientes que coincidan con los filtros."
      />
    </div>
  );
}
