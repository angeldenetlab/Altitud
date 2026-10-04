"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/labels";
import { purchasesService } from "@/services/purchasesService";
import { projectsService } from "@/services/projectsService";
import type { CostCategory } from "@/types/altitude";

const CATEGORY_ITEMS = CATEGORY_ORDER.filter((category) => category !== "mano_obra").map(
  (category) => ({ value: category, label: CATEGORY_LABELS[category] }),
);

/**
 * Compra cargada directo al proyecto: quien compra la captura una vez y ya
 * queda en el costo real, sin recapturas. [R-23] [R-24]
 */
export function CreatePurchaseDialog({ requestedBy }: { requestedBy?: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    project_id: "",
    supplier: "",
    category: "materiales" as CostCategory,
    concept: "",
    amount: "",
    invoice_folio: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const projects = useQuery({
    queryKey: ["projects", "picker"],
    queryFn: () => projectsService.list({}),
    enabled: open,
  });
  const suppliers = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => purchasesService.suppliers(),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () =>
      purchasesService.create({
        project_id: Number(form.project_id),
        supplier: form.supplier,
        category: form.category,
        concept: form.concept,
        amount: Number(form.amount || 0),
        invoice_folio: form.invoice_folio || undefined,
        date: form.date,
        requested_by: requestedBy,
      }),
    onSuccess: (purchase) => {
      toast.success(`Compra ${purchase.folio} registrada en ${purchase.project_folio}`);
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["project"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setForm((current) => ({ ...current, concept: "", amount: "", invoice_folio: "" }));
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "No se pudo registrar la compra"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus /> Registrar compra
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva compra</DialogTitle>
          <DialogDescription>
            El importe se carga al gasto real del proyecto en la partida elegida. El XML y el
            pago se siguen llevando en CONTPAQi. [R-35]
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Proyecto</Label>
            <SelectField
              value={form.project_id}
              onChange={(value) => setForm((current) => ({ ...current, project_id: value }))}
              items={(projects.data?.rows ?? []).map((row) => ({
                value: String(row.id),
                label: `${row.folio} · ${row.name}`,
              }))}
              placeholder="Selecciona el proyecto"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Proveedor</Label>
              <Input
                value={form.supplier}
                onChange={(event) => setForm((current) => ({ ...current, supplier: event.target.value }))}
                list="suppliers-list"
                placeholder="Nombre del proveedor"
              />
              <datalist id="suppliers-list">
                {(suppliers.data?.rows ?? []).map((supplier) => (
                  <option key={supplier} value={supplier} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-1.5">
              <Label>Partida</Label>
              <SelectField
                value={form.category}
                onChange={(value) =>
                  setForm((current) => ({ ...current, category: value as CostCategory }))
                }
                items={CATEGORY_ITEMS}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Concepto</Label>
            <Input
              value={form.concept}
              onChange={(event) => setForm((current) => ({ ...current, concept: event.target.value }))}
              placeholder="Ej. Pintura y sellador"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Importe</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Factura (opcional)</Label>
              <Input
                value={form.invoice_folio}
                onChange={(event) =>
                  setForm((current) => ({ ...current, invoice_folio: event.target.value }))
                }
                placeholder="F-1234"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!form.project_id || !form.amount || create.isPending}
          >
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
