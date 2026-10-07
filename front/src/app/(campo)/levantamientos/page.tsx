"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, MapPin, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { canPerform } from "@/lib/auth/rbac";
import { formatDate } from "@/lib/format";
import { AREA_SHORT } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { projectsService } from "@/services/projectsService";

/** Bandeja de campo: los que siguen en espera de cotización. */
export default function LevantamientosPage() {
  const { session } = useAuth();
  const canWrite = session ? canPerform(session.role, "levantamientos.write") : false;

  const query = useQuery({
    queryKey: ["projects", "levantamiento"],
    queryFn: () => projectsService.list({ stage: "levantamiento" }),
  });

  const rows = query.data?.rows ?? [];

  return (
    <div className="mx-auto grid w-full max-w-xl gap-4">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Levantamientos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lo que se vio en sitio. En oficina se cotiza; aquí no hay precio.
        </p>
      </div>

      {canWrite && (
        <Link
          href="/levantamientos/nuevo"
          className={cn(buttonVariants(), "h-12 w-full text-base")}
        >
          <Plus className="size-5" />
          Levantar sitio
        </Link>
      )}

      {query.isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center">
          <ClipboardList className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nadie en espera de cotización. El alta queda en Proyectos como levantamiento.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/levantamientos/${row.id}`}
                className="block rounded-2xl border border-border bg-card px-4 py-4 shadow-sm active:bg-muted/50"
              >
                <p className="font-mono text-xs font-semibold text-primary">{row.folio}</p>
                <p className="mt-1 text-base font-medium leading-snug">{row.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{row.client}</p>
                {row.site && (
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    <span>{row.site}</span>
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {AREA_SHORT[row.area]}
                  {row.survey?.done_by ? ` · ${row.survey.done_by}` : ""}
                  {row.survey?.date ? ` · ${formatDate(row.survey.date)}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
