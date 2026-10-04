"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ACTIVITY_STATE, StatusBadge } from "@/components/data/StatusBadge";
import { formatDate } from "@/lib/format";
import { chatterService } from "@/services/chatterService";
import type { ChatterActivity } from "@/types/altitude";

/** Ruta del front para el registro relacionado. */
function activityHref(activity: ChatterActivity): string {
  return activity.res_model === "quote"
    ? `/cotizaciones/${activity.res_id}`
    : `/proyectos/${activity.res_id}`;
}

/** Campanita: actividades pendientes del equipo. */
export function NotificationBell() {
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => chatterService.notifications(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const data = query.data;
  const pending = (data?.overdue ?? 0) + (data?.today ?? 0);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Pendientes"
            className="relative rounded-full text-muted-foreground hover:text-foreground"
          />
        }
      >
        <Bell />
        {pending > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
            {pending > 9 ? "9+" : pending}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="font-heading text-sm font-semibold">Pendientes</p>
          <p className="text-xs text-muted-foreground">
            {data?.overdue ?? 0} vencidas · {data?.today ?? 0} de hoy · {data?.planned ?? 0} planeadas
          </p>
        </div>
        {(data?.activities.length ?? 0) === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Sin actividades pendientes.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {data?.activities.map((activity) => (
              <li key={activity.id} className="border-b border-border last:border-0">
                <Link
                  href={activityHref(activity)}
                  className="block px-4 py-3 transition-colors hover:bg-muted/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{activity.summary}</p>
                    <StatusBadge status={activity.state} map={ACTIVITY_STATE} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {activity.res_name} · {activity.user_name} · {formatDate(activity.date_deadline)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
