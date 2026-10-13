import Link from "next/link";
import { ClipboardList, Inbox } from "lucide-react";
import { SurveyCard } from "@/components/survey/survey-card";
import { cn } from "@/lib/utils";
import { requireSession } from "@/server/session";
import { listSurveys } from "@/server/surveys";

export const metadata = { title: "Mis levantamientos" };

const TABS = [
  { scope: "mios", label: "Míos" },
  { scope: "todos", label: "Todos los abiertos" },
] as const;

export default async function SurveysPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const session = await requireSession("/levantamientos");
  const { ver } = await searchParams;
  const scope = ver === "todos" ? "todos" : "mios";

  const surveys = await listSurveys(session.employeeId, scope === "mios" ? "mine" : "all");
  const pending = surveys.filter((survey) => survey.state === "abierto");
  const done = surveys.filter((survey) => survey.state === "listo");

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Levantamientos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {scope === "mios"
            ? "Los sitios que te tocan. Captura y ciérralos desde aquí."
            : "Todo lo que sigue abierto. La asignación se hace desde Odoo."}
        </p>
      </div>

      <nav className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" aria-label="Filtro">
        {TABS.map((tab) => (
          <Link
            key={tab.scope}
            href={tab.scope === "mios" ? "/levantamientos" : "/levantamientos?ver=todos"}
            aria-current={scope === tab.scope ? "page" : undefined}
            className={cn(
              "flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-colors",
              scope === tab.scope
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground active:bg-card/60",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {surveys.length === 0 ? (
        <EmptyState scope={scope} />
      ) : (
        <div className="grid gap-5">
          <ul className="grid gap-3">
            {pending.map((survey) => (
              <li key={survey.id}>
                <SurveyCard survey={survey} showOwner={scope === "todos"} />
              </li>
            ))}
          </ul>

          {done.length > 0 && (
            <section className="grid gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Cerrados ({done.length})
              </h2>
              <ul className="grid gap-3">
                {done.map((survey) => (
                  <li key={survey.id}>
                    <SurveyCard survey={survey} showOwner={scope === "todos"} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ scope }: { scope: "mios" | "todos" }) {
  const Icon = scope === "mios" ? Inbox : ClipboardList;
  return (
    <div className="rounded-2xl border border-dashed border-border px-5 py-14 text-center">
      <Icon className="mx-auto size-8 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">
        {scope === "mios"
          ? "No tienes levantamientos asignados."
          : "No hay levantamientos abiertos. Oficina los da de alta en Odoo."}
      </p>
      {scope === "mios" && (
        <Link
          href="/levantamientos?ver=todos"
          className="mt-4 inline-flex text-sm font-semibold text-primary underline-offset-4 active:underline"
        >
          Ver todos los abiertos
        </Link>
      )}
    </div>
  );
}
