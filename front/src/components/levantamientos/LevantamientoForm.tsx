"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ClientPicker, type ClientSelection } from "@/components/clientes/ClientPicker";
import { SelectField } from "@/components/data/SelectField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { AREA_LABELS, AREA_SHORT, COMPANY_SHORT } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { projectsService } from "@/services/projectsService";
import type { ProjectArea, ProjectRow } from "@/types/altitude";

const AREA_ITEMS = (Object.keys(AREA_LABELS) as ProjectArea[]).map((area) => ({
  value: area,
  label: AREA_LABELS[area],
}));

const COMPANY_ITEMS = (Object.keys(COMPANY_SHORT) as (keyof typeof COMPANY_SHORT)[]).map((code) => ({
  value: code,
  label: COMPANY_SHORT[code],
}));

type MeasureRow = { key: string; label: string; value: string; unit: string };

const fieldClass = "h-12 text-base md:text-base";

async function filesToPayload(files: FileList | null) {
  if (!files?.length) return [];
  return Promise.all(
    Array.from(files).map(
      (file) =>
        new Promise<{ title: string; datas: string; mimetype: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = String(reader.result ?? "");
            const comma = result.indexOf(",");
            resolve({
              title: file.name,
              datas: comma >= 0 ? result.slice(comma + 1) : result,
              mimetype: file.type || "image/jpeg",
            });
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        }),
    ),
  );
}

function validMeasures(rows: MeasureRow[]) {
  return rows
    .filter((row) => row.label.trim() && Number(row.value) > 0)
    .map((row) => ({
      label: row.label.trim(),
      value: Number(row.value),
      unit: row.unit || "m²",
    }));
}

/**
 * Formulario de tableta: el lead. Sin precio, sin partidas.
 * Al guardar, el mismo PRY-… espera cotización en Proyectos.
 */
export function LevantamientoForm({
  project,
  defaultDoneBy,
  canWrite,
}: {
  project?: ProjectRow;
  defaultDoneBy?: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const editing = Boolean(project);

  const [name, setName] = useState(project?.name ?? "");
  const [clientSelection, setClientSelection] = useState<ClientSelection>({
    clientId: project?.client_id,
    clientName: project?.client ?? "",
  });
  const [site, setSite] = useState(project?.site ?? "");
  const [area, setArea] = useState<string>(project?.area ?? "limpieza");
  const [company, setCompany] = useState<string>(project?.company ?? "altitude");
  const [doneBy, setDoneBy] = useState(project?.survey?.done_by || defaultDoneBy || "");
  const [conditions, setConditions] = useState(
    project?.survey?.notes || project?.notes || "",
  );
  const [measures, setMeasures] = useState<MeasureRow[]>(
    project?.survey?.measurements.length
      ? project.survey.measurements.map((row, index) => ({
          key: `m${index}`,
          label: row.label,
          value: String(row.value),
          unit: row.unit,
        }))
      : [{ key: "m1", label: "Área", value: "", unit: "m²" }],
  );
  const [photos, setPhotos] = useState<FileList | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        client_id: clientSelection.clientId,
        client: clientSelection.clientName,
        site: site.trim(),
        area,
        company,
        done_by: doneBy.trim(),
        conditions: conditions.trim(),
        notes: conditions.trim(),
        measurements: validMeasures(measures),
        photos: await filesToPayload(photos),
      };
      if (project) {
        return projectsService.saveSurvey({
          id: project.id,
          name: payload.name,
          client_id: payload.client_id,
          client: payload.client,
          site: payload.site,
          done_by: payload.done_by,
          conditions: payload.conditions,
          notes: payload.notes,
          measurements: payload.measurements,
          photos: payload.photos,
        });
      }
      return projectsService.create(payload);
    },
    onSuccess: (saved) => {
      toast.success(
        editing
          ? `Levantamiento ${saved.folio} actualizado`
          : `Levantamiento ${saved.folio} registrado. Espera cotización en Proyectos.`,
      );
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project", saved.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setPhotos(null);
      router.push("/levantamientos");
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError
          ? error.message
          : editing
            ? "No se pudo guardar el levantamiento"
            : "No se pudo registrar el levantamiento",
      ),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    if (!name.trim() || !clientSelection.clientId) {
      toast.error("Captura qué se levantó y selecciona un cliente");
      return;
    }
    if (!site.trim()) {
      toast.error("Captura el sitio");
      return;
    }
    if (!doneBy.trim()) {
      toast.error("Captura quién fue al sitio");
      return;
    }
    if (!conditions.trim()) {
      toast.error("Describe las condiciones del sitio");
      return;
    }
    if (validMeasures(measures).length === 0) {
      toast.error("Captura al menos una medida");
      return;
    }
    save.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto grid w-full max-w-xl gap-5 pb-32">
      <div className="grid gap-2">
        <Label className="text-sm">Qué se levantó</Label>
        <Input
          value={name}
          disabled={!canWrite}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ej. Fachada torre corporativa, Insurgentes"
          className={fieldClass}
        />
      </div>

      <div className="[&_[data-slot=select-trigger]]:h-12 [&_[data-slot=select-trigger]]:text-base">
        <ClientPicker
          value={clientSelection}
          onChange={setClientSelection}
          disabled={!canWrite}
        />
      </div>

      <div className="grid gap-2">
        <Label className="text-sm">Sitio</Label>
        <Input
          value={site}
          disabled={!canWrite}
          onChange={(event) => setSite(event.target.value)}
          placeholder="Dirección o referencia"
          className={fieldClass}
        />
      </div>

      {editing ? (
        <p className="text-sm text-muted-foreground">
          {AREA_SHORT[project!.area]} · {COMPANY_SHORT[project!.company]}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label className="text-sm">Área</Label>
            <SelectField
              value={area}
              onChange={setArea}
              items={AREA_ITEMS}
              className={fieldClass}
              disabled={!canWrite}
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-sm">Razón social</Label>
            <SelectField
              value={company}
              onChange={setCompany}
              items={COMPANY_ITEMS}
              className={fieldClass}
              disabled={!canWrite}
            />
          </div>
        </div>
      )}

      <div className="grid gap-2">
        <Label className="text-sm">Quién fue al sitio</Label>
        <Input
          value={doneBy}
          disabled={!canWrite}
          onChange={(event) => setDoneBy(event.target.value)}
          placeholder="Nombre"
          className={fieldClass}
        />
      </div>

      <div className="grid gap-3">
        <Label className="text-sm">Medidas</Label>
        {measures.map((row, index) => (
          <div key={row.key} className="grid grid-cols-[1.4fr_0.9fr_0.7fr_auto] gap-2">
            <Input
              value={row.label}
              disabled={!canWrite}
              placeholder="Qué se midió"
              className={fieldClass}
              onChange={(event) =>
                setMeasures((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, label: event.target.value } : item,
                  ),
                )
              }
            />
            <Input
              type="number"
              inputMode="decimal"
              value={row.value}
              disabled={!canWrite}
              placeholder="Valor"
              className={fieldClass}
              onChange={(event) =>
                setMeasures((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, value: event.target.value } : item,
                  ),
                )
              }
            />
            <Input
              value={row.unit}
              disabled={!canWrite}
              placeholder="Unidad"
              className={fieldClass}
              onChange={(event) =>
                setMeasures((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, unit: event.target.value } : item,
                  ),
                )
              }
            />
            {canWrite && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-12"
                onClick={() =>
                  setMeasures((current) => current.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                <Trash2 className="size-5 text-destructive" />
              </Button>
            )}
          </div>
        ))}
        {canWrite && (
          <Button
            type="button"
            variant="outline"
            className="h-11 self-start"
            onClick={() =>
              setMeasures((current) => [
                ...current,
                { key: `m${Date.now()}`, label: "", value: "", unit: "m²" },
              ])
            }
          >
            <Plus className="size-4" />
            Agregar medida
          </Button>
        )}
      </div>

      <div className="grid gap-2">
        <Label className="text-sm">Condiciones del sitio</Label>
        <Textarea
          value={conditions}
          disabled={!canWrite}
          rows={5}
          className="min-h-32 text-base md:text-base"
          placeholder="Accesos, restricciones, estado de los espacios, lo que hay que cotizar…"
          onChange={(event) => setConditions(event.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label className="text-sm">Fotografías</Label>
        {(project?.survey?.photos.length ?? 0) > 0 && (
          <ul className="flex flex-wrap gap-2">
            {project!.survey!.photos.map((photo) => (
              <li
                key={photo.id}
                className="flex size-24 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-muted/40 text-[10px] text-muted-foreground"
              >
                <Camera className="size-5" />
                <span className="px-1 text-center leading-tight">{photo.title}</span>
              </li>
            ))}
          </ul>
        )}
        {canWrite && (
          <>
            <Input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="h-auto py-3"
              onChange={(event) => setPhotos(event.target.files)}
            />
            {photos?.length ? (
              <p className="text-sm text-muted-foreground">
                {photos.length} {photos.length === 1 ? "foto lista" : "fotos listas"} para subir
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Recomendado. Usa la cámara de la tableta.</p>
            )}
          </>
        )}
      </div>

      {canWrite && (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pt-3",
            "pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur",
          )}
        >
          <div className="mx-auto max-w-xl">
            <Button type="submit" className="h-12 w-full text-base" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="size-5 animate-spin" /> : null}
              {editing ? "Guardar levantamiento" : "Registrar levantamiento"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
