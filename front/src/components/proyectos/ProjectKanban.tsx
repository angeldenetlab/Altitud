"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GripVertical, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { AREA_STATUS, StatusBadge } from "@/components/data/StatusBadge";
import { ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { projectsService } from "@/services/projectsService";
import type { ProjectRow, ProjectStage } from "@/types/altitude";

/**
 * Kanban de etapas al estilo del ERP: arrastra la tarjeta para mover el
 * proyecto de etapa. Cada movimiento queda en la bitácora del proyecto.
 */
export function ProjectKanban({
  rows,
  canWrite,
}: {
  rows: ProjectRow[];
  canWrite: boolean;
}) {
  const queryClient = useQueryClient();
  const [dragging, setDragging] = useState<number | null>(null);
  const [hovered, setHovered] = useState<ProjectStage | null>(null);

  const setStage = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: ProjectStage }) =>
      projectsService.setStage(id, stage),
    onSuccess: (project) => {
      toast.success(`${project.folio} → ${STAGE_LABELS[project.stage]}`);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "No se pudo mover el proyecto"),
  });

  function handleDrop(stage: ProjectStage) {
    setHovered(null);
    if (!canWrite || dragging === null) return;
    const project = rows.find((row) => row.id === dragging);
    setDragging(null);
    if (!project || project.stage === stage) return;
    setStage.mutate({ id: project.id, stage });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {STAGE_ORDER.map((stage) => {
        const stageRows = rows.filter((row) => row.stage === stage);
        const amount = stageRows.reduce((acc, row) => acc + row.totals.billable_total, 0);

        return (
          <div
            key={stage}
            onDragOver={(event) => {
              if (!canWrite) return;
              event.preventDefault();
              setHovered(stage);
            }}
            onDragLeave={() => setHovered((current) => (current === stage ? null : current))}
            onDrop={() => handleDrop(stage)}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-2xl border bg-muted/30 transition-colors",
              hovered === stage ? "border-primary bg-primary/[0.06]" : "border-border",
            )}
          >
            <div className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-2.5">
              <div>
                <p className="font-heading text-sm font-semibold">{STAGE_LABELS[stage]}</p>
                <p className="text-[11px] text-muted-foreground">
                  {stage === "levantamiento"
                    ? `${stageRows.length} en espera de cotización`
                    : `${stageRows.length} · ${formatCurrency(amount)}`}
                </p>
              </div>
            </div>

            <div className="flex min-h-24 flex-col gap-2 p-2">
              {stageRows.map((row) => (
                <article
                  key={row.id}
                  draggable={canWrite}
                  onDragStart={() => setDragging(row.id)}
                  onDragEnd={() => setDragging(null)}
                  className={cn(
                    "group rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow",
                    canWrite && "cursor-grab active:cursor-grabbing hover:shadow-md",
                    dragging === row.id && "opacity-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/proyectos/${row.id}`}
                      className="font-mono text-xs font-semibold text-primary hover:underline"
                    >
                      {row.folio}
                    </Link>
                    <div className="flex items-center gap-1">
                      {row.totals.variance > 0 && (
                        <span title="Gasto real por encima del presupuesto">
                          <TriangleAlert className="size-3.5 text-destructive" />
                        </span>
                      )}
                      {canWrite && (
                        <GripVertical className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
                    </div>
                  </div>

                  <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">{row.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.client}</p>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <StatusBadge status={row.area} map={AREA_STATUS} className="text-[10px]" />
                    <span
                      className={cn(
                        "text-xs font-semibold tabular-nums",
                        row.totals.margin_pct < 15 ? "text-destructive" : "text-success",
                      )}
                    >
                      {row.totals.margin_pct}%
                    </span>
                  </div>

                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${row.totals.progress}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                    <span>{row.totals.progress}% avance</span>
                    <span className="tabular-nums">{formatCurrency(row.totals.billable_total)}</span>
                  </div>
                </article>
              ))}

              {stageRows.length === 0 && (
                <p className="rounded-lg border border-dashed border-border px-2 py-6 text-center text-[11px] text-muted-foreground">
                  {stage === "levantamiento"
                    ? "En espera de cotización. Se captura en Levantamientos."
                    : canWrite
                      ? "Arrastra un proyecto aquí"
                      : "Sin proyectos"}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
