"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Paginación server-side estilo Odoo: rango visible + anterior/siguiente.
 * `offset` y `total` vienen del BFF, así que no se cargan miles de filas.
 */
export function TablePagination({
  offset,
  limit,
  total,
  isLoading,
  onOffsetChange,
  label = "registros",
}: {
  offset: number;
  limit: number;
  total: number;
  isLoading?: boolean;
  onOffsetChange: (offset: number) => void;
  label?: string;
}) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">
        {isLoading ? (
          "Cargando…"
        ) : (
          <>
            <span className="font-medium text-foreground tabular-nums">
              {from}–{to}
            </span>{" "}
            de <span className="font-medium text-foreground tabular-nums">{total}</span> {label}
          </>
        )}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canPrev || isLoading}
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
        >
          <ChevronLeft /> Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canNext || isLoading}
          onClick={() => onOffsetChange(offset + limit)}
        >
          Siguiente <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
