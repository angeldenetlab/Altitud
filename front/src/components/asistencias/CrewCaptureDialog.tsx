"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { ATTENDANCE_KIND_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { attendanceService } from "@/services/attendanceService";
import { projectsService } from "@/services/projectsService";
import type { AttendanceKind } from "@/types/altitude";

const KIND_ITEMS = (Object.keys(ATTENDANCE_KIND_LABELS) as AttendanceKind[]).map((kind) => ({
  value: kind,
  label: ATTENDANCE_KIND_LABELS[kind],
}));

/**
 * Captura de la cuadrilla completa en un proyecto. Es la alternativa "web" a
 * la captura por WhatsApp: el supervisor marca a todos de un jalón. [R-17]
 */
export function CrewCaptureDialog({ date }: { date: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [kind, setKind] = useState<string>("completa");
  const [selected, setSelected] = useState<number[]>([]);

  const projects = useQuery({
    queryKey: ["projects", "picker"],
    queryFn: () => projectsService.list({}),
    enabled: open,
  });
  // Solo la cuadrilla del proyecto: marcar a alguien que no está asignado
  // le cargaría a esa obra un jornal que nunca trabajó ahí. [R-19]
  const employees = useQuery({
    queryKey: ["employees", "crew", projectId],
    queryFn: () => attendanceService.employees(undefined, undefined, Number(projectId)),
    enabled: open && Boolean(projectId),
  });

  const create = useMutation({
    mutationFn: () =>
      attendanceService.createBatch({
        project_id: Number(projectId),
        date,
        kind,
        source: "supervisor",
        employee_ids: selected,
      }),
    onSuccess: (result) => {
      if (result.created > 0) toast.success(`${result.created} asistencia(s) registradas`);
      if (result.skipped.length > 0) {
        toast.info(`Ya tenían asistencia: ${result.skipped.join(", ")}`);
      }
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["project"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setSelected([]);
      setOpen(false);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "No se pudo registrar la asistencia"),
  });

  const activeProjects = (projects.data?.rows ?? []).filter((row) =>
    ["autorizado", "ejecucion", "por_cerrar"].includes(row.stage),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <UserPlus /> Registrar cuadrilla
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Asistencia de cuadrilla</DialogTitle>
          <DialogDescription>
            Selecciona el proyecto y marca a los que llegaron. El costo de mano de obra se
            calcula con el jornal de cada uno. [R-19] [R-20]
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Proyecto</Label>
              <SelectField
                value={projectId}
                onChange={(value) => {
                  setProjectId(value);
                  setSelected([]);
                }}
                items={activeProjects.map((row) => ({
                  value: String(row.id),
                  label: `${row.folio} · ${row.name}`,
                }))}
                placeholder="Selecciona el proyecto"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Jornada</Label>
              <SelectField value={kind} onChange={setKind} items={KIND_ITEMS} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Personal ({selected.length} seleccionados)</Label>
            <div className="grid max-h-72 gap-1.5 overflow-y-auto rounded-xl border border-border p-2 sm:grid-cols-2">
              {!projectId ? (
                <p className="col-span-full px-2 py-6 text-center text-sm text-muted-foreground">
                  Elige primero el proyecto: solo se marca a su cuadrilla.
                </p>
              ) : (employees.data?.rows ?? []).length === 0 ? (
                <p className="col-span-full px-2 py-6 text-center text-sm text-muted-foreground">
                  Esta obra todavía no tiene cuadrilla. Ármala en Asistencias › Cuadrillas.
                </p>
              ) : null}
              {(employees.data?.rows ?? []).map((employee) => {
                const isSelected = selected.includes(employee.id);
                return (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() =>
                      setSelected((current) =>
                        isSelected
                          ? current.filter((id) => id !== employee.id)
                          : [...current, employee.id],
                      )
                    }
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{employee.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {employee.job}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      ${employee.jornal}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!projectId || selected.length === 0 || create.isPending}
          >
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Registrar {selected.length > 0 ? `(${selected.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
