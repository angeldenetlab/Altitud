"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/data/SelectField";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ACTIVITY_STATE, StatusBadge } from "@/components/data/StatusBadge";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { chatterService } from "@/services/chatterService";

function today(offset = 1) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

/**
 * Actividades del registro: así se delega el siguiente paso de la etapa a una
 * persona con fecha. [R-05] (avance) y base de la operación por etapas.
 */
export function ActividadesPanel({
  model,
  resId,
  invalidate = [],
}: {
  model: "project" | "quote" | "client";
  resId: number;
  invalidate?: unknown[][];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [note, setNote] = useState("");
  const [deadline, setDeadline] = useState(today(1));
  const [typeId, setTypeId] = useState("4");
  const [userId, setUserId] = useState("4");

  const activities = useQuery({
    queryKey: ["activities", model, resId],
    queryFn: () => chatterService.activities(model, resId),
    enabled: Number.isFinite(resId) && resId > 0,
  });
  const types = useQuery({ queryKey: ["activityTypes"], queryFn: () => chatterService.activityTypes() });
  const users = useQuery({ queryKey: ["chatterUsers"], queryFn: () => chatterService.users() });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["activities", model, resId] });
    queryClient.invalidateQueries({ queryKey: ["chatter", model, resId] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    invalidate.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
  }

  const schedule = useMutation({
    mutationFn: () =>
      chatterService.schedule({
        model,
        res_id: resId,
        summary,
        note,
        date_deadline: deadline,
        activity_type_id: Number(typeId),
        user_id: Number(userId),
      }),
    onSuccess: () => {
      toast.success("Actividad delegada");
      setSummary("");
      setNote("");
      setOpen(false);
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "No se pudo programar la actividad"),
  });

  const complete = useMutation({
    mutationFn: (id: number) => chatterService.done(id, "Hecho"),
    onSuccess: () => {
      toast.success("Actividad cerrada");
      refresh();
    },
  });

  const rows = activities.data?.rows ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" />
          <h3 className="font-heading text-sm font-semibold">Actividades</h3>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((value) => !value)}>
          <Plus className="size-4" />
          Delegar
        </Button>
      </div>

      {open && (
        <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">Qué hay que hacer</Label>
            <Input
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Ej. Recabar firma de conformidad"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Tipo</Label>
              <SelectField
                value={typeId}
                onChange={setTypeId}
                items={(types.data?.rows ?? []).map((type) => ({
                  value: String(type.id),
                  label: type.name,
                }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Responsable</Label>
              <SelectField
                value={userId}
                onChange={setUserId}
                items={(users.data?.rows ?? []).map((user) => ({
                  value: String(user.id),
                  label: user.name,
                }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Fecha límite</Label>
              <Input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Nota (opcional)</Label>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => schedule.mutate()}
              disabled={!summary.trim() || schedule.isPending}
            >
              {schedule.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Programar
            </Button>
          </div>
        </div>
      )}

      {activities.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-4 text-center text-sm text-muted-foreground">
          Sin actividades pendientes.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((activity) => (
            <li
              key={activity.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{activity.summary}</p>
                  <StatusBadge status={activity.state} map={ACTIVITY_STATE} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {activity.activity_type} · {activity.user_name} · {formatDate(activity.date_deadline)}
                </p>
                {activity.note && <p className="mt-1 text-xs text-muted-foreground">{activity.note}</p>}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => complete.mutate(activity.id)}
                disabled={complete.isPending}
                title="Marcar como hecha"
              >
                <Check className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
