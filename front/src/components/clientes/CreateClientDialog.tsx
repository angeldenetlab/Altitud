"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { COMPANY_SHORT } from "@/lib/labels";
import { clientsService } from "@/services/clientsService";
import type { Client } from "@/types/altitude";

const COMPANY_ITEMS = (Object.keys(COMPANY_SHORT) as (keyof typeof COMPANY_SHORT)[]).map((code) => ({
  value: code,
  label: COMPANY_SHORT[code],
}));

export function CreateClientDialog({
  trigger,
  onCreated,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  onCreated?: (client: Client) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rfc, setRfc] = useState("");
  const [company, setCompany] = useState("altitude");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () =>
      clientsService.create({
        name,
        contact: contact || undefined,
        email: email || undefined,
        phone: phone || undefined,
        rfc: rfc || undefined,
        company,
        notes: notes || undefined,
      }),
    onSuccess: (client) => {
      toast.success(`Cliente ${client.folio} registrado`);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      onCreated?.(client);
      setOpen(false);
      setName("");
      setContact("");
      setEmail("");
      setPhone("");
      setRfc("");
      setCompany("altitude");
      setNotes("");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "No se pudo registrar el cliente"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : controlledOpen === undefined ? (
        <DialogTrigger render={<Button />}>
          <Plus /> Nuevo cliente
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) {
              toast.error("Captura el nombre del cliente");
              return;
            }
            create.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
            <DialogDescription>
              Se genera un folio y queda disponible para cotizaciones, órdenes y proyectos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label>Razón social o nombre</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Inmobiliaria Andares SA de CV"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Contacto</Label>
                <Input value={contact} onChange={(event) => setContact(event.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Teléfono</Label>
                <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Correo</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>RFC</Label>
                <Input value={rfc} onChange={(event) => setRfc(event.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Razón social de facturación</Label>
              <SelectField value={company} onChange={setCompany} items={COMPANY_ITEMS} />
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
              Registrar cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
