"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  HardHat,
  Plus,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { KpiCard } from "@/components/data/KpiCard";
import { PageHeader } from "@/components/data/PageHeader";
import { SelectField } from "@/components/data/SelectField";
import {
  ATTENDANCE_STATUS,
  AREA_STATUS,
  SOURCE_STATUS,
  StatusBadge,
} from "@/components/data/StatusBadge";
import { CrewCaptureDialog } from "@/components/asistencias/CrewCaptureDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { canPerform } from "@/lib/auth/rbac";
import { formatCurrency, formatDate } from "@/lib/format";
import { AREA_SHORT } from "@/lib/labels";
import { attendanceService } from "@/services/attendanceService";
import { projectsService } from "@/services/projectsService";

/**
 * Asistencias: la cuadrilla de cada obra, la distribución del día y el costo
 * de mano de obra que eso genera. [R-17] … [R-22]
 *
 * Solo se marca a quien está en la cuadrilla del proyecto: es lo que evita
 * cargarle a una obra el jornal de alguien que nunca estuvo ahí.
 */
export default function AsistenciasPage() {
  const { session } = useAuth();
  const canWrite = session ? canPerform(session.role, "asistencias.write") : false;
  const queryClient = useQueryClient();

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [tab, setTab] = useState("dia");
  const [crewProject, setCrewProject] = useState("");
  const [crewSearch, setCrewSearch] = useState("");

  const board = useQuery({
    queryKey: ["attendance", "board", date],
    queryFn: () => attendanceService.board(date),
  });
  const history = useQuery({
    queryKey: ["attendance", "history"],
    queryFn: () => attendanceService.list({}),
  });
  const projects = useQuery({
    queryKey: ["projects", "picker"],
    queryFn: () => projectsService.list({}),
  });
  const crew = useQuery({
    queryKey: ["projects", "crew", crewProject],
    queryFn: () => projectsService.crew(Number(crewProject)),
    enabled: Boolean(crewProject),
  });
  const staff = useQuery({
    queryKey: ["attendance", "staff"],
    queryFn: () => attendanceService.employees(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["attendance"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["project"] });
  };

  const reassign = useMutation({
    mutationFn: ({ id, projectId }: { id: number; projectId: number }) =>
      attendanceService.reassign(id, projectId),
    onSuccess: () => {
      toast.success("Personal reasignado");
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => attendanceService.remove(id),
    onSuccess: () => {
      toast.success("Asistencia eliminada");
      invalidate();
    },
  });

  const assignCrew = useMutation({
    mutationFn: (employeeId: number) =>
      projectsService.assignCrew(Number(crewProject), [employeeId]),
    onSuccess: () => {
      toast.success("Agregado a la cuadrilla");
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "No se pudo agregar"),
  });

  const unassignCrew = useMutation({
    mutationFn: (employeeId: number) =>
      projectsService.unassignCrew(Number(crewProject), employeeId),
    onSuccess: () => {
      toast.success("Fuera de la cuadrilla. Sus asistencias anteriores se conservan.");
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "No se pudo quitar"),
  });

  const markPending = useMutation({
    mutationFn: ({ employeeId, projectId }: { employeeId: number; projectId: number }) =>
      attendanceService.create({
        employee_id: employeeId,
        project_id: projectId,
        kind: "completa",
        date,
        source: "supervisor",
      }),
    onSuccess: () => {
      toast.success("Jornada registrada");
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "No se pudo registrar"),
  });

  const projectItems = (projects.data?.rows ?? [])
    .filter((row) => ["autorizado", "ejecucion", "por_cerrar"].includes(row.stage))
    .map((row) => ({ value: String(row.id), label: `${row.folio} · ${row.name}` }));

  const data = board.data;

  // La cuadrilla son los activos. Quien fue dado de baja de la obra vuelve a
  // aparecer entre los candidatos: agregarlo otra vez lo reactiva y conserva
  // sus asistencias anteriores.
  const crewMembers = (crew.data?.rows ?? []).filter((row) => row.active);
  const crewIds = new Set(crewMembers.map((row) => row.employee_id));
  const term = crewSearch.trim().toLocaleLowerCase("es-MX");
  const candidates = (staff.data?.rows ?? []).filter(
    (employee) =>
      !crewIds.has(employee.id) &&
      (!term ||
        employee.name.toLocaleLowerCase("es-MX").includes(term) ||
        employee.job.toLocaleLowerCase("es-MX").includes(term)),
  );

  return (
    <div>
      <PageHeader
        title="Asistencias"
        description="Quién está en qué proyecto hoy, cuánto cuesta ese día y de dónde salió cada registro. [R-21]"
        actions={canWrite ? <CrewCaptureDialog date={date} /> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Presentes" value={data?.present ?? 0} icon={UserCheck} tone="positive" isLoading={board.isLoading} />
        <KpiCard label="Faltas" value={data?.absent ?? 0} icon={UserMinus} tone="negative" isLoading={board.isLoading} />
        <KpiCard
          label="Sin cuadrilla"
          value={data?.unassigned.length ?? 0}
          icon={Users}
          tone="warning"
          isLoading={board.isLoading}
          hint="Activos que no están en ninguna obra en curso"
        />
        <KpiCard
          label="Costo del día"
          value={formatCurrency(data?.cost_day)}
          icon={BadgeDollarSign}
          isLoading={board.isLoading}
          hint="Jornal × asistencias, sin captura manual"
        />
      </div>

      <div className="my-5 flex flex-wrap items-center gap-3">
        <div className="grid gap-1.5">
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-44" />
        </div>
        <div className="flex flex-wrap gap-2">
          {(data?.by_area ?? []).map((row) => (
            <span
              key={row.area}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs"
            >
              <StatusBadge status={row.area} map={AREA_STATUS} className="text-[10px]" />
              {row.present} personas · {formatCurrency(row.cost)}
            </span>
          ))}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(String(value ?? "dia"))}>
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="dia">Distribución del día</TabsTrigger>
          <TabsTrigger value="cuadrillas">
            <HardHat className="size-3.5" />
            Cuadrillas
          </TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="dia">
          {board.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
              <div className="grid gap-4">
                {(data?.by_project ?? []).length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center text-sm text-muted-foreground">
                    Sin asistencias registradas este día.
                    {!data?.is_workday ? " (domingo)" : ""}
                  </p>
                ) : (
                  data?.by_project.map((project) => (
                    <Card key={project.project_id}>
                      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/proyectos/${project.project_id}`}
                              className="font-mono text-xs font-semibold text-primary hover:underline"
                            >
                              {project.folio}
                            </Link>
                            <StatusBadge status={project.area} map={AREA_STATUS} />
                          </div>
                          <CardTitle className="mt-1 truncate text-base">{project.name}</CardTitle>
                        </div>
                        <div className="text-right">
                          <p className="font-heading text-lg font-bold">{project.present}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(project.cost)}</p>
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3">
                        <div className="flex flex-wrap gap-2">
                        {project.people.map((person) => (
                          <div
                            key={person.attendance_id}
                            className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-3 pr-1.5 text-xs"
                          >
                            <span className="font-medium">{person.name}</span>
                            <StatusBadge status={person.kind} map={ATTENDANCE_STATUS} className="text-[10px]" />
                            <StatusBadge status={person.source} map={SOURCE_STATUS} className="text-[10px]" />
                            {canWrite && (
                              <div className="flex items-center">
                                <SelectField
                                  value=""
                                  onChange={(value) =>
                                    reassign.mutate({
                                      id: person.attendance_id,
                                      projectId: Number(value),
                                    })
                                  }
                                  items={projectItems.filter(
                                    (item) => item.value !== String(project.project_id),
                                  )}
                                  placeholder="Mover…"
                                  className="h-7 w-28 text-[11px]"
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  onClick={() => remove.mutate(person.attendance_id)}
                                >
                                  <Trash2 className="size-3.5 text-destructive" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                        </div>

                        {(project.pending ?? []).length > 0 && (
                          <div className="rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2.5">
                            <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                              En la cuadrilla, sin registro hoy
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {(project.pending ?? []).map((person) => (
                                <div
                                  key={person.employee_id}
                                  className="flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-3 pr-1.5 text-xs"
                                >
                                  <span className="font-medium text-muted-foreground">
                                    {person.name}
                                  </span>
                                  {canWrite && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2 text-[11px]"
                                      onClick={() =>
                                        markPending.mutate({
                                          employeeId: person.employee_id,
                                          projectId: project.project_id,
                                        })
                                      }
                                    >
                                      Marcar
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="text-base">Sin cuadrilla</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Personal activo que no está asignado a ninguna obra en curso. Agrégalo a una
                    cuadrilla para poder marcarle asistencia. [R-22]
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-1.5">
                  {(data?.unassigned ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Toda la plantilla está en alguna cuadrilla.
                    </p>
                  ) : (
                    data?.unassigned.map((employee) => (
                      <div
                        key={employee.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{employee.name}</p>
                          <p className="truncate text-muted-foreground">
                            {employee.job} · ${employee.jornal}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                          {employee.area === "mixto" ? "mixto" : AREA_SHORT[employee.area]}
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cuadrillas">
          <Card>
            <CardHeader>
              <CardTitle>Cuadrilla de la obra</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Quién de la plantilla presta servicio en este proyecto. Solo a ellos se les puede
                marcar asistencia, y de ahí sale el costo de mano de obra. Una persona puede estar
                en varias obras. [R-19]
              </p>
            </CardHeader>
            <CardContent>
              <SelectField
                value={crewProject}
                onChange={setCrewProject}
                items={projectItems}
                placeholder="Elige el proyecto"
                className="w-full sm:w-96"
              />

              {!crewProject ? (
                <p className="mt-6 rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center text-sm text-muted-foreground">
                  Elige un proyecto para ver y armar su cuadrilla.
                </p>
              ) : (
                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      En la cuadrilla ({crewMembers.length})
                    </p>
                    {crew.isLoading ? (
                      <Skeleton className="h-40 w-full" />
                    ) : crewMembers.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                        Todavía no hay nadie asignado.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {crewMembers.map((member) => (
                          <li
                            key={member.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">{member.employee_name}</p>
                              <p className="truncate text-muted-foreground">
                                {member.job} · {formatCurrency(member.jornal)} por jornal
                              </p>
                            </div>
                            {canWrite && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 shrink-0"
                                onClick={() => unassignCrew.mutate(member.employee_id)}
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Agregar de la plantilla
                    </p>
                    <Input
                      value={crewSearch}
                      onChange={(event) => setCrewSearch(event.target.value)}
                      placeholder="Buscar por nombre o puesto"
                      className="mb-2"
                    />
                    <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
                      {candidates.length === 0 ? (
                        <li className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                          No queda nadie por agregar.
                        </li>
                      ) : (
                        candidates.map((employee) => (
                          <li
                            key={employee.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">{employee.name}</p>
                              <p className="truncate text-muted-foreground">
                                {employee.job} · {formatCurrency(employee.jornal)} por jornal
                              </p>
                            </div>
                            {canWrite && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 shrink-0 px-2 text-[11px]"
                                onClick={() => assignCrew.mutate(employee.id)}
                              >
                                <Plus className="size-3.5" />
                                Agregar
                              </Button>
                            )}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial">
          <Card>
            <CardHeader>
              <CardTitle>Historial de asistencias</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {history.data?.jornales ?? 0} jornales · {formatCurrency(history.data?.cost)} de mano
                de obra en el periodo cargado.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[32rem] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-b border-border bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Fecha</th>
                      <th className="px-5 py-3">Colaborador</th>
                      <th className="px-5 py-3">Proyecto</th>
                      <th className="px-5 py-3">Jornada</th>
                      <th className="px-5 py-3">Origen</th>
                      <th className="px-5 py-3 text-right">Costo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(history.data?.rows ?? []).map((row) => (
                      <tr key={row.id}>
                        <td className="px-5 py-2.5">{formatDate(row.date)}</td>
                        <td className="px-5 py-2.5">{row.employee_name}</td>
                        <td className="px-5 py-2.5 font-mono text-xs">{row.project_folio}</td>
                        <td className="px-5 py-2.5">
                          <StatusBadge status={row.kind} map={ATTENDANCE_STATUS} />
                        </td>
                        <td className="px-5 py-2.5">
                          <StatusBadge status={row.source} map={SOURCE_STATUS} />
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums">{formatCurrency(row.cost)}</td>
                      </tr>
                    ))}
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
