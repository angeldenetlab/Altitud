import { PhotoGrid } from "@/components/survey/photo-grid";
import { Section } from "@/components/ui/field";
import type { Survey } from "@/types/survey";

/** La captura ya hecha, de solo lectura. */
export function CaptureSummary({ survey }: { survey: Survey }) {
  return (
    <div className="grid gap-4">
      <Section title="Captura del sitio">
        <Detail label="Descripción" value={survey.description} />
        <Detail
          label="Número de plantas"
          value={survey.floorCount ? String(survey.floorCount) : ""}
        />
        <Detail label="Condiciones del sitio" value={survey.siteConditions} />

        <div>
          <p className="text-sm font-medium">Medidas</p>
          {survey.measures.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Sin capturar.</p>
          ) : (
            <ul className="mt-2 grid gap-1.5">
              {survey.measures.map((measure, index) => (
                <li
                  key={index}
                  className="flex items-baseline justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2 text-sm"
                >
                  <span className="min-w-0">{measure.label}</span>
                  <span className="shrink-0 font-mono font-medium">
                    {measure.value} {measure.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section title="Fotografías">
        <PhotoGrid surveyId={survey.id} photos={survey.photos} editable={false} />
      </Section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
        {value || "Sin capturar."}
      </p>
    </div>
  );
}
