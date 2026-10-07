"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Plus, Ruler, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { projectsService } from "@/services/projectsService";
import type { ProjectRow } from "@/types/altitude";

type MeasureRow = { key: string; label: string; value: string; unit: string };

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

export function ProjectSurveyTab({
  project,
  canWrite,
}: {
  project: ProjectRow;
  canWrite: boolean;
}) {
  const queryClient = useQueryClient();
  const survey = project.survey;
  const [doneBy, setDoneBy] = useState(survey?.done_by ?? "");
  const [conditions, setConditions] = useState(survey?.notes ?? project.notes ?? "");
  const [measures, setMeasures] = useState<MeasureRow[]>(
    survey?.measurements.length
      ? survey.measurements.map((row, index) => ({
          key: `m${index}`,
          label: row.label,
          value: String(row.value),
          unit: row.unit,
        }))
      : [{ key: "m1", label: "Área", value: "", unit: "m²" }],
  );
  const [photos, setPhotos] = useState<FileList | null>(null);

  const save = useMutation({
    mutationFn: async () =>
      projectsService.saveSurvey({
        id: project.id,
        done_by: doneBy || undefined,
        conditions: conditions || undefined,
        notes: conditions || undefined,
        measurements: measures
          .filter((row) => row.label.trim() && Number(row.value) > 0)
          .map((row) => ({
            label: row.label,
            value: Number(row.value),
            unit: row.unit || "m²",
          })),
        photos: await filesToPayload(photos),
      }),
    onSuccess: () => {
      toast.success("Levantamiento guardado");
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setPhotos(null);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "No se pudo guardar el levantamiento"),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Lo que se vio en sitio</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Medidas, condiciones y quién fue. Desde aquí se genera la cotización.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          {survey && (
            <p className="text-xs text-muted-foreground">
              {survey.done_by} · {survey.date ? formatDate(survey.date) : "sin fecha"}
            </p>
          )}
          <div className="grid gap-1.5">
            <Label>Quién fue al sitio</Label>
            <Input
              value={doneBy}
              disabled={!canWrite}
              onChange={(event) => setDoneBy(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Medidas</Label>
            {measures.map((row, index) => (
              <div key={row.key} className="grid gap-2 sm:grid-cols-[1.4fr_0.8fr_0.6fr_auto]">
                <Input
                  value={row.label}
                  disabled={!canWrite}
                  placeholder="Qué se midió"
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
                  value={row.value}
                  disabled={!canWrite}
                  placeholder="Valor"
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
                    onClick={() =>
                      setMeasures((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {canWrite && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
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
          <div className="grid gap-1.5">
            <Label>Condiciones</Label>
            <Textarea
              value={conditions}
              disabled={!canWrite}
              rows={4}
              onChange={(event) => setConditions(event.target.value)}
            />
          </div>
          {canWrite && (
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Ruler className="size-4" />}
              Guardar levantamiento
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fotografías</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            {(survey?.photos ?? []).map((photo) => (
              <div
                key={photo.id}
                className="flex size-24 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-gradient-to-br from-primary/20 to-primary/5 text-[10px] text-muted-foreground"
              >
                <Camera className="size-5" />
                <span className="px-1 text-center leading-tight">{photo.title}</span>
              </div>
            ))}
            {(survey?.photos.length ?? 0) === 0 && (
              <p className="w-full rounded-lg border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                Sin fotos del sitio.
              </p>
            )}
          </div>
          {canWrite && (
            <div className="grid gap-2">
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => setPhotos(event.target.files)}
              />
              <Button
                variant="outline"
                onClick={() => save.mutate()}
                disabled={!photos?.length || save.isPending}
              >
                {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Subir fotos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
