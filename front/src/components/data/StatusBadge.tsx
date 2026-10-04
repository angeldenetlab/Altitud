import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "slate" | "blue" | "amber" | "emerald" | "red" | "violet";

const toneClasses: Record<Tone, string> = {
  slate: "bg-muted text-muted-foreground border-transparent",
  blue: "bg-primary/10 text-primary border-transparent",
  amber: "bg-accent/25 text-accent-foreground border-transparent",
  emerald: "bg-success/12 text-success border-transparent",
  red: "bg-destructive/10 text-destructive border-transparent",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-transparent",
};

export interface StatusMeta {
  label: string;
  tone: Tone;
}

/** Etapas del proyecto: es la columna del kanban. */
export const PROJECT_STAGE: Record<string, StatusMeta> = {
  levantamiento: { label: "Levantamiento", tone: "slate" },
  cotizado: { label: "Cotizado", tone: "blue" },
  autorizado: { label: "Autorizado", tone: "violet" },
  ejecucion: { label: "En ejecución", tone: "amber" },
  por_cerrar: { label: "Por cerrar", tone: "blue" },
  cerrado: { label: "Cerrado", tone: "emerald" },
  perdido: { label: "Perdido", tone: "red" },
};

/** Flujo de autorización de cotizaciones. [R-13] [R-15] */
export const QUOTE_STATUS: Record<string, StatusMeta> = {
  levantamiento: { label: "Levantamiento", tone: "slate" },
  calculo: { label: "En cálculo", tone: "blue" },
  vobo_socio: { label: "Espera VoBo", tone: "amber" },
  enviada: { label: "Enviada", tone: "violet" },
  autorizada: { label: "Autorizada", tone: "emerald" },
  no_autorizada: { label: "No autorizada", tone: "red" },
};

export const AREA_STATUS: Record<string, StatusMeta> = {
  altura: { label: "Altura", tone: "blue" },
  limpieza: { label: "Limpieza", tone: "emerald" },
  obra: { label: "Obra", tone: "amber" },
};

/** Estatus de la compra; el pago y el XML se conservan en CONTPAQi. [R-35] */
export const PURCHASE_STATUS: Record<string, StatusMeta> = {
  sin_factura: { label: "Sin factura", tone: "amber" },
  por_pagar: { label: "Por pagar", tone: "blue" },
  pagada: { label: "Pagada", tone: "emerald" },
};

export const ATTENDANCE_STATUS: Record<string, StatusMeta> = {
  completa: { label: "Completa", tone: "emerald" },
  media: { label: "Media", tone: "amber" },
  falta: { label: "Falta", tone: "red" },
};

export const SOURCE_STATUS: Record<string, StatusMeta> = {
  portal: { label: "Portal", tone: "emerald" },
  supervisor: { label: "Supervisor", tone: "blue" },
  web: { label: "Web", tone: "slate" },
};

/** Estado de la próxima actividad del registro. */
export const ACTIVITY_STATE: Record<string, StatusMeta> = {
  overdue: { label: "Vencida", tone: "red" },
  today: { label: "Hoy", tone: "amber" },
  planned: { label: "Planeada", tone: "blue" },
};

export const EXTRA_KIND: Record<string, StatusMeta> = {
  extra: { label: "Extra", tone: "amber" },
  faltante: { label: "Faltante", tone: "red" },
};

export function StatusBadge({
  status,
  map,
  className,
}: {
  status?: string | null;
  map: Record<string, StatusMeta>;
  className?: string;
}) {
  if (!status) {
    return <span className="text-muted-foreground">—</span>;
  }

  const meta = map[status] ?? { label: status, tone: "slate" as Tone };

  return (
    <Badge
      variant="outline"
      className={cn("font-medium", toneClasses[meta.tone], className)}
    >
      {meta.label}
    </Badge>
  );
}
