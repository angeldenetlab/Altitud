import { cn } from "@/lib/utils";
import type { SurveyState } from "@/types/survey";

const STATE: Record<SurveyState, { label: string; className: string }> = {
  abierto: { label: "Por capturar", className: "bg-accent/25 text-accent-foreground" },
  listo: { label: "Listo", className: "bg-success/15 text-success" },
};

export function StateBadge({ state, className }: { state: SurveyState; className?: string }) {
  const { label, className: tone } = STATE[state];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        tone,
        className,
      )}
    >
      {label}
    </span>
  );
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
