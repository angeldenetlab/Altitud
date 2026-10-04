"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BadgeDollarSign, FolderKanban, LayoutGrid, List, Percent, Search, TriangleAlert } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data/DataTable";
import { KpiCard } from "@/components/data/KpiCard";
import { PageHeader } from "@/components/data/PageHeader";
import { SelectField } from "@/components/data/SelectField";
import { AREA_STATUS, PROJECT_STAGE, StatusBadge } from "@/components/data/StatusBadge";
import { CreateProjectDialog } from "@/components/proyectos/CreateProjectDialog";
import { ProjectKanban } from "@/components/proyectos/ProjectKanban";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { canPerform } from "@/lib/auth/rbac";
import { formatCurrency, formatDate } from "@/lib/format";
import { AREA_LABELS, COMPANY_SHORT, STAGE_LABELS, STAGE_ORDER } from "@/lib/labels";
import { projectsService } from "@/services/projectsService";
import type { ProjectArea, ProjectRow } from "@/types/altitude";

const AREA_ITEMS = [
  { value: "todas", label: "Todas las áreas" },
  ...(Object.keys(AREA_LABELS) as ProjectArea[]).map((area) => ({
    value: area,
    label: AREA_LABELS[area],
  })),
];

const STAGE_ITEMS = [
  { value: "todas", label: "Todas las etapas" },
  ...STAGE_ORDER.map((stage) => ({ value: stage, label: STAGE_LABELS[stage] })),
  { value: "perdido", label: STAGE_LABELS.perdido },
];

const COMPANY_ITEMS = [
  { value: "todas", label: "Ambas razones sociales" },
  ...(Object.keys(COMPANY_SHORT) as (keyof typeof COMPANY_SHORT)[]).map((code) => ({
    value: code,
    label: COMPANY_SHORT[code],
  })),
];

/** Directorio único de proyectos con vista de lista y kanban de etapas. [R-01] [R-02] [R-29] */
export default function ProyectosPage() {
  const { session } = useAuth();
  const canWrite = session ? canPerform(session.role, "proyectos.write") : false;

  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("todas");
  const [stage, setStage] = useState("todas");
  const [company, setCompany] = useState("todas");
  const [onlyOverrun, setOnlyOverrun] = useState(false);

  const query = useQuery({
    queryKey: ["projects", search, area, stage, company, onlyOverrun],
    queryFn: () =>
      projectsService.list({
        search,
        area: area as ProjectArea | "todas",
        stage: stage as never,
        company: company as never,
        only_overrun: onlyOverrun,
      }),
  });

  const rows = query.data?.rows ?? [];

  const columns: DataTableColumn<ProjectRow>[] = [
    {
      key: "folio",
      header: "Folio",
      render: (row) => (
        <Link href={`/proyectos/${row.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
          {row.folio}
        </Link>
      ),
    },
    {
      key: "name",
      header: "Proyecto",
      render: (row) => (
        <div className="min-w-0">
          <p className="max-w-72 truncate font-medium">{row.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.client} · {COMPANY_SHORT[row.company]}
          </p>
        </div>
      ),
    },
    { key: "area", header: "Área", render: (row) => <StatusBadge status={row.area} map={AREA_STATUS} /> },
    { key: "stage", header: "Etapa", render: (row) => <StatusBadge status={row.stage} map={PROJECT_STAGE} /> },
    {
      key: "progress",
      header: "Avance",
      render: (row) => (
        <div className="flex w-28 items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${row.totals.progress}%` }} />
          </div>
          <span className="tabular-nums text-xs text-muted-foreground">{row.totals.progress}%</span>
        </div>
      ),
    },
    {
      key: "budget",
      header: "Presupuesto",
      className: "text-right",
      render: (row) => (
        <div className="text-right">
          <span className="tabular-nums">{formatCurrency(row.totals.budget_total)}</span>
          <p className="text-[11px] text-muted-foreground">
            al avance {formatCurrency(row.totals.earned_budget)}
          </p>
        </div>
      ),
    },
    {
      key: "actual",
      header: "Gasto real",
      className: "text-right",
      render: (row) => (
        <span className={`tabular-nums ${row.totals.variance > 0 ? "text-destructive" : ""}`}>
          {formatCurrency(row.totals.actual_total)}
        </span>
      ),
    },
    {
      key: "margin",
      header: "Margen",
      className: "text-right",
      render: (row) => (
        <span
          className={`font-semibold tabular-nums ${
            row.totals.margin_pct < 15 ? "text-destructive" : "text-success"
          }`}
        >
          {row.totals.margin_pct}%
        </span>
      ),
    },
    { key: "start", header: "Inicio", render: (row) => formatDate(row.start_date) },
  ];

  return (
    <div>
      <PageHeader
        title="Proyectos"
        description="Un módulo para altura, limpieza y obra: la estructura de costeo es la misma en las tres. [R-08]"
        actions={canWrite ? <CreateProjectDialog /> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="En el directorio" value={query.data?.total ?? 0} icon={FolderKanban} isLoading={query.isLoading} />
        <KpiCard label="Activos" value={query.data?.active ?? 0} icon={LayoutGrid} isLoading={query.isLoading} />
        <KpiCard
          label="Cobrable"
          value={formatCurrency(query.data?.contracted)}
          icon={BadgeDollarSign}
          tone="positive"
          isLoading={query.isLoading}
        />
        <KpiCard
          label="Gasto real"
          value={formatCurrency(query.data?.actual)}
          icon={Percent}
          tone="warning"
          isLoading={query.isLoading}
        />
      </div>

      <div className="my-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Folio, cliente, sitio…"
            className="pl-8"
          />
        </div>
        <SelectField value={area} onChange={setArea} items={AREA_ITEMS} className="w-48" />
        <SelectField value={company} onChange={setCompany} items={COMPANY_ITEMS} className="w-52" />
        {view === "lista" && (
          <SelectField value={stage} onChange={setStage} items={STAGE_ITEMS} className="w-44" />
        )}
        <Button
          variant={onlyOverrun ? "default" : "outline"}
          size="sm"
          onClick={() => setOnlyOverrun((value) => !value)}
        >
          <TriangleAlert className="size-4" />
          Sobre presupuesto
        </Button>

        <div className="ml-auto flex rounded-lg border border-border p-0.5">
          <Button
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("kanban")}
          >
            <LayoutGrid className="size-4" />
            Kanban
          </Button>
          <Button
            variant={view === "lista" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("lista")}
          >
            <List className="size-4" />
            Lista
          </Button>
        </div>
      </div>

      {view === "kanban" ? (
        <ProjectKanban rows={rows} canWrite={canWrite} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          isLoading={query.isLoading}
          emptyMessage="No hay proyectos que coincidan con los filtros."
        />
      )}
    </div>
  );
}
