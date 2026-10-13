"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2, CloudOff, Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { closeSurveyAction, saveCaptureAction } from "@/app/levantamientos/actions";
import { MeasuresEditor } from "@/components/survey/measures-editor";
import { PhotoGrid } from "@/components/survey/photo-grid";
import { Button } from "@/components/ui/button";
import { Field, Input, Section, Textarea } from "@/components/ui/field";
import { formatTime } from "@/lib/format";
import { type CaptureValues, type Photo, missingToClose } from "@/types/survey";

/**
 * Captura de sitio.
 *
 * Guarda sola: en una azotea nadie se acuerda de apretar «guardar», y si la
 * señal se cae lo capturado se queda en el teléfono hasta que vuelve. Cerrar
 * es lo único explícito, porque es lo que deja el levantamiento listo para
 * cotizar.
 */

type Status = "limpio" | "sucio" | "guardando" | "guardado" | "error";

const AUTOSAVE_MS = 1500;

function sameValues(a: CaptureValues, b: CaptureValues): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function CaptureForm({
  surveyId,
  initial,
  photos,
}: {
  surveyId: number;
  initial: CaptureValues;
  photos: Photo[];
}) {
  const [values, setValues] = useState<CaptureValues>(initial);
  const [status, setStatus] = useState<Status>("limpio");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [closing, setClosing] = useState(false);

  const router = useRouter();
  const latest = useRef(values);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const storageKey = `levantamiento:${surveyId}`;

  const persistLocal = useCallback(
    (next: CaptureValues | null) => {
      try {
        if (next) window.localStorage.setItem(storageKey, JSON.stringify(next));
        else window.localStorage.removeItem(storageKey);
      } catch {
        // Modo privado o almacenamiento lleno: no es motivo para perder la pantalla.
      }
    },
    [storageKey],
  );

  const save = useCallback(async () => {
    if (saving.current) return;
    saving.current = true;
    setStatus("guardando");

    try {
      // Mientras siga escribiendo, se vuelve a mandar lo último: una sola
      // escritura en vuelo, nunca una cola de versiones viejas.
      let snapshot = latest.current;
      let settled = false;

      while (!settled) {
        const result = await saveCaptureAction(surveyId, snapshot);
        if (!result.ok) {
          setStatus("error");
          return;
        }
        persistLocal(null);
        settled = sameValues(snapshot, latest.current);
        snapshot = latest.current;
      }

      setStatus("guardado");
      setSavedAt(new Date());
    } finally {
      saving.current = false;
    }
  }, [persistLocal, surveyId]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  }, [save]);

  function change(patch: Partial<CaptureValues>) {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setValues(next);
    setStatus("sucio");
    persistLocal(next);
    schedule();
  }

  // Lo que quedó sin subir en la visita anterior (señal caída, pantalla cerrada).
  useEffect(() => {
    let stored: CaptureValues | null = null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      stored = raw ? (JSON.parse(raw) as CaptureValues) : null;
    } catch {
      stored = null;
    }
    if (!stored || sameValues(stored, initial)) {
      persistLocal(null);
      return;
    }
    latest.current = stored;
    // Recuperar el borrador local obliga a sincronizar el estado al montar:
    // antes de eso no existe `localStorage` y el servidor pintaría otra cosa.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(stored);
    setStatus("sucio");
    toast.info("Recuperamos lo que capturaste sin conexión.");
    schedule();
    // Solo al montar: después manda lo que el empleado está escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === "limpio" || status === "guardado") return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const missing = missingToClose(values);

  async function close() {
    if (missing.length > 0) {
      toast.error(`Falta ${missing.join(", ")}.`);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setClosing(true);

    const result = await closeSurveyAction(surveyId, latest.current);
    setClosing(false);

    if (result.ok) {
      persistLocal(null);
      setStatus("guardado");
      toast.success("Levantamiento cerrado. Oficina ya puede cotizar.");
      router.refresh();
    } else {
      toast.error(result.error ?? "No se pudo cerrar.");
    }
  }

  return (
    <div className="grid gap-4 pb-4">
      <Section title="Qué hay que hacer" description="Lo que vio el empleado en el sitio.">
        <Field label="Descripción" required>
          <Textarea
            value={values.description}
            onChange={(event) => change({ description: event.target.value })}
            placeholder="Trabajo por hacer, alcance, lo que pidió el cliente…"
          />
        </Field>

        <Field label="Número de plantas" required hint="Niveles del inmueble, incluida la planta baja.">
          <Input
            value={values.floorCount ? String(values.floorCount) : ""}
            onChange={(event) =>
              change({ floorCount: Number(event.target.value.replace(/\D/g, "")) || 0 })
            }
            inputMode="numeric"
            placeholder="0"
            className="w-32"
          />
        </Field>

        <Field label="Condiciones del sitio" required>
          <Textarea
            value={values.siteConditions}
            onChange={(event) => change({ siteConditions: event.target.value })}
            placeholder="Accesos, restricciones de horario, anclajes, estado del inmueble…"
          />
        </Field>
      </Section>

      <Section title="Medidas" description="Al menos una. De aquí sale el costeo.">
        <MeasuresEditor measures={values.measures} onChange={(measures) => change({ measures })} />
      </Section>

      <Section title="Fotografías" description="Evidencia del sitio, no de la ejecución.">
        <PhotoGrid surveyId={surveyId} photos={photos} editable />
      </Section>

      <div className="sticky bottom-0 -mx-4 mt-1 border-t border-border/70 bg-background/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        <div className="mb-2.5 flex min-h-5 items-center justify-between gap-3 text-xs">
          <SaveStatus status={status} savedAt={savedAt} onRetry={() => void save()} />
          {missing.length > 0 && (
            <span className="flex items-center gap-1.5 text-right text-muted-foreground">
              <AlertTriangle className="size-3.5 shrink-0" />
              Falta {missing.join(", ")}
            </span>
          )}
        </div>
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={close}
          disabled={closing || missing.length > 0}
        >
          {closing ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
          {closing ? "Cerrando…" : "Cerrar levantamiento"}
        </Button>
      </div>
    </div>
  );
}

function SaveStatus({
  status,
  savedAt,
  onRetry,
}: {
  status: Status;
  savedAt: Date | null;
  onRetry: () => void;
}) {
  if (status === "guardando") {
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Guardando…
      </span>
    );
  }
  if (status === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1.5 font-medium text-destructive"
      >
        <CloudOff className="size-3.5" />
        Sin guardar · Reintentar
        <RotateCw className="size-3.5" />
      </button>
    );
  }
  if (status === "sucio") {
    return <span className="text-muted-foreground">Cambios sin guardar…</span>;
  }
  if (status === "guardado") {
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <CheckCircle2 className="size-3.5 text-success" />
        Guardado {savedAt ? formatTime(savedAt) : ""}
      </span>
    );
  }
  return <span className="text-muted-foreground">Se guarda solo</span>;
}
