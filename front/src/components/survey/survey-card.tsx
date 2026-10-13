import Link from "next/link";
import { ChevronRight, MapPin, User } from "lucide-react";
import { Chip, StateBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { AREA_LABEL, type SurveyRow } from "@/types/survey";

export function SurveyCard({ survey, showOwner }: { survey: SurveyRow; showOwner?: boolean }) {
  return (
    <Link
      href={`/levantamientos/${survey.id}`}
      className="surface-elevated flex items-center gap-3 rounded-2xl px-4 py-4 active:bg-muted/60"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-primary">{survey.folio}</span>
          <StateBadge state={survey.state} />
        </div>

        <p className="mt-1.5 text-base leading-snug font-medium">{survey.name}</p>

        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">{survey.sitio}</span>
        </p>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {survey.area && <Chip>{AREA_LABEL[survey.area]}</Chip>}
          {showOwner && (
            <Chip>
              <User className="size-3" />
              {survey.mine ? "Tuyo" : survey.employeeName || "Sin asignar"}
            </Chip>
          )}
          {survey.partnerName && <Chip>{survey.partnerName}</Chip>}
          {survey.surveyDate && <Chip>{formatDate(survey.surveyDate)}</Chip>}
        </div>
      </div>

      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
