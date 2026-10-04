"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { ClientPicker, type ClientSelection } from "@/components/clientes/ClientPicker";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { AREA_LABELS, COMPANY_SHORT } from "@/lib/labels";
import { projectsService } from "@/services/projectsService";
import type { ProjectArea } from "@/types/altitude";

const AREA_ITEMS = (Object.keys(AREA_LABELS) as ProjectArea[]).map((area) => ({
  value: area,
  label: AREA_LABELS[area],
}));

const COMPANY_ITEMS = (Object.keys(COMPANY_SHORT) as (keyof typeof COMPANY_SHORT)[]).map((code) => ({
  value: code,
  label: COMPANY_SHORT[code],
}));

/**
 * Alta de proyecto: todo trabajo entra al directorio con folio, sin importar
 * su tamaño. [R-01] [R-02] [R-37]
 */
export function CreateProjectDialog() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientSelection, setClientSelection] = useState<ClientSelection>({ clientName: "" });
  const [site, setSite] = useState("");
  const [area, setArea] = useState<string>("limpieza");
  const [company, setCompany] = useState<string>("altitude");
  const [supervisor, setSupervisor] = useState("");
  const [contract, setContract] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () =>
      projectsService.create({
        name,
        client_id: clientSelection.clientId,
        client: clientSelection.clientName,
        site: site || undefined,
        area,
        company,
        supervisor: supervisor || undefined,
        contract_amount: Number(contract || 0),
        start_date: startDate,
        notes: notes || undefined,
      }),
    onSuccess: (project) => {
      toast.success(`Proyecto ${project.folio} creado`);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setName("");
      setClientSelection({ clientName: "" });
      setSite("");
      setContract("");
      setNotes("");
      router.push(`/proyectos/${project.id}`);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "No se pudo crear el proyecto"),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !clientSelection.clientId) {
      toast.error("Captura el nombre del trabajo y selecciona un cliente");
      return;
    }
    create.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus /> Nuevo proyecto
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo proyecto</DialogTitle>
            <DialogDescription>
              Se genera el folio y un presupuesto base por partidas que después se ajusta.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label>Nombre del trabajo</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Lavado de cristal torre corporativa"
              />
            </div>
            <ClientPicker value={clientSelection} onChange={setClientSelection} />
            <div className="grid gap-1.5">
              <Label>Sitio</Label>
              <Input
                value={site}
                onChange={(event) => setSite(event.target.value)}
                placeholder="Dirección o referencia"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Área</Label>
                <SelectField value={area} onChange={setArea} items={AREA_ITEMS} />
              </div>
              <div className="grid gap-1.5">
                <Label>Razón social</Label>
                <SelectField value={company} onChange={setCompany} items={COMPANY_ITEMS} />
              </div>
              <div className="grid gap-1.5">
                <Label>Inicio</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Precio de venta (sin IVA)</Label>
                <Input
                  type="number"
                  min={0}
                  value={contract}
                  onChange={(event) => setContract(event.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Supervisor</Label>
                <Input
                  value={supervisor}
                  onChange={(event) => setSupervisor(event.target.value)}
                  placeholder="Quién lo va a llevar"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Crear proyecto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
