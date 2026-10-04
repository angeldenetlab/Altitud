"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Plus, Save, ShieldCheck, Users, Wrench } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/data/PageHeader";
import { SelectField } from "@/components/data/SelectField";
import { AREA_STATUS, StatusBadge } from "@/components/data/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { canPerform } from "@/lib/auth/rbac";
import { getRoleLabel } from "@/lib/auth/roles";
import { formatCurrency } from "@/lib/format";
import { AREA_LABELS } from "@/lib/labels";
import { catalogsService } from "@/services/catalogsService";
import type { ProjectArea, ServiceItem } from "@/types/altitude";

const AREA_ITEMS = (Object.keys(AREA_LABELS) as ProjectArea[]).map((area) => ({
  value: area,
  label: AREA_LABELS[area],
}));

const emptyService = {
  id: 0,
  code: "",
  name: "",
  area: "limpieza",
  unit: "m²",
  price_unit: "",
  cost_unit: "",
  yield_per_jornal: "",
};

/**
 * Catálogos: servicios con paramétricos, personal con su jornal, razones
 * sociales y accesos. [R-10] [R-16] [R-20] [R-33] [R-37]
 */
export default function CatalogosPage() {
  const { session } = useAuth();
  const canWrite = session ? canPerform(session.role, "catalogos.write") : false;
  const queryClient = useQueryClient();

  const [tab, setTab] = useState("servicios");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyService);

  const services = useQuery({ queryKey: ["catalog", "services"], queryFn: () => catalogsService.services() });
  const employees = useQuery({ queryKey: ["catalog", "employees"], queryFn: () => catalogsService.employees() });
  const companies = useQuery({ queryKey: ["catalog", "companies"], queryFn: () => catalogsService.companies() });
  const users = useQuery({ queryKey: ["catalog", "users"], queryFn: () => catalogsService.users() });

  const saveService = useMutation({
    mutationFn: () =>
      catalogsService.saveService({
        id: form.id || undefined,
        code: form.code,
        name: form.name,
        area: form.area,
        unit: form.unit,
        price_unit: Number(form.price_unit || 0),
        cost_unit: Number(form.cost_unit || 0),
        yield_per_jornal: Number(form.yield_per_jornal || 1),
      }),
    onSuccess: () => {
      toast.success("Servicio guardado");
      queryClient.invalidateQueries({ queryKey: ["catalog", "services"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      setOpen(false);
    },
  });

  function editService(service: ServiceItem) {
    setForm({
      id: service.id,
      code: service.code,
      name: service.name,
      area: service.area,
      unit: service.unit,
      price_unit: String(service.price_unit),
      cost_unit: String(service.cost_unit),
      yield_per_jornal: String(service.yield_per_jornal),
    });
    setOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Catálogos"
        description="La base para cotizar rápido y para que el costo de mano de obra se calcule solo."
        actions={
          canWrite && tab === "servicios" ? (
            <Button
              onClick={() => {
                setForm(emptyService);
                setOpen(true);
              }}
            >
              <Plus /> Nuevo servicio
            </Button>
          ) : undefined
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(String(value ?? "servicios"))}>
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="servicios">
            <Wrench className="size-3.5" />
            Servicios y paramétricos
          </TabsTrigger>
          <TabsTrigger value="personal">
            <Users className="size-3.5" />
            Personal
          </TabsTrigger>
          <TabsTrigger value="empresas">
            <Building2 className="size-3.5" />
            Razones sociales
          </TabsTrigger>
          <TabsTrigger value="accesos">
            <ShieldCheck className="size-3.5" />
            Accesos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="servicios">
          <Card>
            <CardHeader>
              <CardTitle>Catálogo de servicios</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Precio estándar por unidad y rendimiento por jornal: con eso se cotiza en
                minutos. [R-10] [R-12] [R-16]
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Código</th>
                      <th className="px-5 py-3">Servicio</th>
                      <th className="px-5 py-3">Área</th>
                      <th className="px-5 py-3">Unidad</th>
                      <th className="px-5 py-3 text-right">Precio</th>
                      <th className="px-5 py-3 text-right">Costo</th>
                      <th className="px-5 py-3 text-right">Margen</th>
                      <th className="px-5 py-3 text-right">Rend./jornal</th>
                      {canWrite && <th className="px-5 py-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(services.data?.rows ?? []).map((service) => {
                      const margin =
                        service.price_unit > 0
                          ? Math.round(((service.price_unit - service.cost_unit) / service.price_unit) * 100)
                          : 0;
                      return (
                        <tr key={service.id}>
                          <td className="px-5 py-2.5 font-mono text-xs">{service.code}</td>
                          <td className="px-5 py-2.5 font-medium">{service.name}</td>
                          <td className="px-5 py-2.5">
                            <StatusBadge status={service.area} map={AREA_STATUS} />
                          </td>
                          <td className="px-5 py-2.5 text-xs text-muted-foreground">{service.unit}</td>
                          <td className="px-5 py-2.5 text-right tabular-nums">
                            {formatCurrency(service.price_unit)}
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(service.cost_unit)}
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            <span
                              className={`font-semibold tabular-nums ${
                                margin < 40 ? "text-accent-foreground" : "text-success"
                              }`}
                            >
                              {margin}%
                            </span>
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums">
                            {service.yield_per_jornal} {service.unit}
                          </td>
                          {canWrite && (
                            <td className="px-5 py-2.5 text-right">
                              <Button size="sm" variant="ghost" onClick={() => editService(service)}>
                                Editar
                              </Button>
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

        <TabsContent value="personal">
          <Card>
            <CardHeader>
              <CardTitle>Personal operativo</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {employees.data?.active ?? 0} activos · jornal promedio{" "}
                {formatCurrency(employees.data?.jornal_avg)}. El jornal individual es lo que
                multiplica las asistencias. [R-20]
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[32rem] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-b border-border bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Colaborador</th>
                      <th className="px-5 py-3">Puesto</th>
                      <th className="px-5 py-3">Área</th>
                      <th className="px-5 py-3">Teléfono</th>
                      <th className="px-5 py-3 text-right">Jornal</th>
                      <th className="px-5 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(employees.data?.rows ?? []).map((employee) => (
                      <tr key={employee.id}>
                        <td className="px-5 py-2.5 font-medium">{employee.name}</td>
                        <td className="px-5 py-2.5 text-xs text-muted-foreground">{employee.job}</td>
                        <td className="px-5 py-2.5">
                          {employee.area === "mixto" ? (
                            <span className="text-xs text-muted-foreground">Mixto</span>
                          ) : (
                            <StatusBadge status={employee.area} map={AREA_STATUS} />
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-xs text-muted-foreground">{employee.phone}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {formatCurrency(employee.jornal)}
                        </td>
                        <td className="px-5 py-2.5 text-xs">
                          {employee.active ? (
                            <span className="text-success">Activo</span>
                          ) : (
                            <span className="text-muted-foreground">Inactivo</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="empresas">
          <div className="grid gap-4 sm:grid-cols-2">
            {(companies.data?.rows ?? []).map((company) => (
              <Card key={company.code}>
                <CardContent className="py-4">
                  <p className="font-heading text-base font-bold">{company.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{company.rfc}</p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {company.projects} proyecto(s) registrados
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Los proyectos, compras y la prenómina se separan por razón social. [R-37]
          </p>
        </TabsContent>

        <TabsContent value="accesos">
          <Card>
            <CardHeader>
              <CardTitle>Usuarios y roles</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Cada rol ve solo sus módulos: los tres socios, control de proyectos,
                administración, tesorería y supervisión de campo. [R-33]
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Usuario</th>
                    <th className="px-5 py-3">Rol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(users.data?.rows ?? []).map((user) => (
                    <tr key={user.id}>
                      <td className="px-5 py-2.5 font-medium">{user.name}</td>
                      <td className="px-5 py-2.5 text-muted-foreground">{getRoleLabel(user.role)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
            <DialogDescription>
              El rendimiento por jornal es lo que permite calcular los jornales de una
              cotización. [R-12]
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-[0.6fr_1.4fr]">
              <div className="grid gap-1.5">
                <Label>Código</Label>
                <Input
                  value={form.code}
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                  placeholder="ALT-06"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Nombre</Label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Área</Label>
                <SelectField
                  value={form.area}
                  onChange={(value) => setForm((current) => ({ ...current, area: value }))}
                  items={AREA_ITEMS}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Unidad</Label>
                <Input
                  value={form.unit}
                  onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
                  placeholder="m², ml, pieza…"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Precio por unidad</Label>
                <Input
                  type="number"
                  value={form.price_unit}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, price_unit: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Costo por unidad</Label>
                <Input
                  type="number"
                  value={form.cost_unit}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, cost_unit: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Rendimiento / jornal</Label>
                <Input
                  type="number"
                  value={form.yield_per_jornal}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, yield_per_jornal: event.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveService.mutate()}
              disabled={!form.code.trim() || !form.name.trim() || saveService.isPending}
            >
              {saveService.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
