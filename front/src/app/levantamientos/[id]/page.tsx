import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, FileText, MapPin, UserCheck } from "lucide-react";
import { CaptureForm } from "@/components/survey/capture-form";
import { CaptureSummary } from "@/components/survey/capture-summary";
import { ReopenButton } from "@/components/survey/reopen-button";
import { Chip, StateBadge } from "@/components/ui/badge";
import { formatDate, mapsUrl } from "@/lib/format";
import { requireSession } from "@/server/session";
import { getSurvey } from "@/server/surveys";
import { AREA_LABEL } from "@/types/survey";

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const surveyId = Number(id);
  if (!Number.isInteger(surveyId) || surveyId <= 0) notFound();

  const session = await requireSession(`/levantamientos/${id}`);
  const survey = await getSurvey(surveyId, session.employeeId);
  if (!survey) notFound();

  const editable = survey.mine && survey.state === "abierto";

  return (
    <div className="grid gap-4">
      <Link
        href="/levantamientos"
        className="-ml-1 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground active:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Levantamientos
      </Link>

      <header className="surface-elevated rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-primary">{survey.folio}</span>
          <StateBadge state={survey.state} />
        </div>

        <h1 className="mt-2 font-heading text-xl leading-snug font-bold">{survey.name}</h1>

        <a
          href={mapsUrl(survey.sitio)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-start gap-1.5 text-sm text-primary underline-offset-4 active:underline"
        >
          <MapPin className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">{survey.sitio}</span>
        </a>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {survey.area && <Chip>{AREA_LABEL[survey.area]}</Chip>}
          {survey.partnerName && <Chip>{survey.partnerName}</Chip>}
          {survey.companyName && (
            <Chip>
              <Building2 className="size-3" />
              {survey.companyName}
            </Chip>
          )}
        </div>

        {survey.state === "listo" && (
          <p className="mt-3 border-t border-border/70 pt-3 text-sm text-muted-foreground">
            Levantó {survey.surveyedByName || survey.employeeName}
            {survey.surveyDate ? ` · ${formatDate(survey.surveyDate)}` : ""}
          </p>
        )}

        {survey.quoteName && (
          <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">
            <FileText className="size-4 shrink-0" />
            Ya se cotizó: {survey.quoteName}
          </p>
        )}
      </header>

      {!survey.mine && survey.state === "abierto" && (
        <section className="surface-elevated rounded-2xl p-4">
          <p className="flex items-start gap-2 text-sm">
            <UserCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              {survey.employeeName ? (
                <>
                  Asignado a <strong className="font-semibold">{survey.employeeName}</strong>.
                </>
              ) : (
                "Sin asignar."
              )}{" "}
              La asignación se hace desde Odoo.
            </span>
          </p>
        </section>
      )}

      {editable ? (
        <CaptureForm
          surveyId={survey.id}
          initial={{
            description: survey.description,
            floorCount: survey.floorCount,
            measures: survey.measures,
            siteConditions: survey.siteConditions,
          }}
          photos={survey.photos}
        />
      ) : (
        <CaptureSummary survey={survey} />
      )}

      {survey.mine && survey.state === "listo" && !survey.quoteName && <ReopenButton surveyId={survey.id} />}
    </div>
  );
}
