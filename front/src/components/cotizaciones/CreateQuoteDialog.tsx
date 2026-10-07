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
import { ApiError } from "@/lib/api";
import { AREA_LABELS, COMPANY_SHORT } from "@/lib/labels";
import { quotesService } from "@/services/quotesService";
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
 * Alta de cotización: nace en levantamiento y cualquiera la puede iniciar,
 * no solo los socios. [R-09] [R-11]
 */
export function CreateQuoteDialog({ owner }: { owner?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientSelection, setClientSelection] = useState<ClientSelection>({ clientName: "" });
  const [area, setArea] = useState("limpieza");
  const [company, setCompany] = useState("altitude");
  const [overhead, setOverhead] = useState("22");

  const create = useMutation({
    mutationFn: () =>
      quotesService.create({
        name,
        client_id: clientSelection.clientId,
        client: clientSelection.clientName,
        area,
        company,
        overhead_pct: Number(overhead || 0),
        owner,
      }),
    onSuccess: (quote) => {
      toast.success(`Cotización ${quote.folio} creada`);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setOpen(false);
      setName("");
      setClientSelection({ clientName: "" });
      router.push(`/cotizaciones/${quote.id}`);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "No se pudo crear la cotización"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus /> Nueva cotización
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim() || !clientSelection.clientId) {
              toast.error("Captura el nombre del trabajo y selecciona un cliente");
              return;
            }
            create.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Nueva cotización</DialogTitle>
            <DialogDescription>
              Un trabajo nuevo entra por un levantamiento en Proyectos. Usa esta alta solo si
              ya analizaste el sitio y vas a costear.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label>Nombre del trabajo</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <ClientPicker value={clientSelection} onChange={setClientSelection} />
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
                <Label>Indirectos %</Label>
                <Input
                  type="number"
                  value={overhead}
                  onChange={(event) => setOverhead(event.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Crear y costear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
