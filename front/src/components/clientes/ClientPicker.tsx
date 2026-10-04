"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { CreateClientDialog } from "@/components/clientes/CreateClientDialog";
import { SelectField } from "@/components/data/SelectField";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { clientsService } from "@/services/clientsService";
import type { Client } from "@/types/altitude";

export interface ClientSelection {
  clientId?: number;
  clientName: string;
}

export function ClientPicker({
  value,
  onChange,
  disabled,
}: {
  value: ClientSelection;
  onChange: (value: ClientSelection) => void;
  disabled?: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);

  const clients = useQuery({
    queryKey: ["clients", "picker"],
    queryFn: () => clientsService.list({ active: true }),
  });

  const items = (clients.data?.rows ?? [])
    .filter((client) => client.active)
    .map((client) => ({
      value: String(client.id),
      label: client.name,
    }));

  const selectedId = value.clientId ? String(value.clientId) : "";

  function handleSelect(next: string) {
    const client = clients.data?.rows.find((row) => String(row.id) === next);
    if (!client) return;
    onChange({ clientId: client.id, clientName: client.name });
  }

  function handleCreated(client: Client) {
    onChange({ clientId: client.id, clientName: client.name });
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-end gap-2">
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Label>Cliente</Label>
          <SelectField
            value={selectedId}
            onChange={handleSelect}
            items={items}
            placeholder={clients.isLoading ? "Cargando clientes…" : "Selecciona un cliente"}
            disabled={disabled || clients.isLoading || items.length === 0}
          />
        </div>
        <CreateClientDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={handleCreated}
          trigger={
            <Button type="button" variant="outline" size="icon" disabled={disabled}>
              <Plus className="size-4" />
              <span className="sr-only">Nuevo cliente</span>
            </Button>
          }
        />
      </div>
      {value.clientName ? (
        <p className="text-xs text-muted-foreground">
          Seleccionado: <span className="font-medium text-foreground">{value.clientName}</span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Elige un cliente del catálogo o regístralo con el botón +.
        </p>
      )}
    </div>
  );
}
