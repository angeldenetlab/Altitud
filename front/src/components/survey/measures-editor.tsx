"use client";

import { Plus, Ruler, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import type { Measure } from "@/types/survey";

const UNITS = ["m", "m²", "m³", "ml", "pz", "niveles"];

/**
 * Medidas del sitio: etiqueta, valor y unidad. Se guardan como JSON en
 * `measurements`, que es el formato que lee oficina para costear.
 */
export function MeasuresEditor({
  measures,
  onChange,
  disabled,
}: {
  measures: Measure[];
  onChange: (measures: Measure[]) => void;
  disabled?: boolean;
}) {
  function update(index: number, patch: Partial<Measure>) {
    onChange(measures.map((measure, i) => (i === index ? { ...measure, ...patch } : measure)));
  }

  function add() {
    onChange([...measures, { label: "", value: "", unit: "m²" }]);
  }

  function remove(index: number) {
    onChange(measures.filter((_, i) => i !== index));
  }

  return (
    <div className="grid gap-3">
      <datalist id="unidades">
        {UNITS.map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>

      {measures.length === 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-muted px-3.5 py-3 text-sm text-muted-foreground">
          <Ruler className="size-4 shrink-0" />
          Sin medidas. Hace falta al menos una para cerrar.
        </p>
      )}

      {measures.map((measure, index) => (
        <div key={index} className="grid gap-2 rounded-xl bg-muted/60 p-2.5">
          <div className="flex items-center gap-2">
            <Input
              value={measure.label}
              onChange={(event) => update(index, { label: event.target.value })}
              placeholder="Qué se midió (fachada, patio…)"
              aria-label={`Medida ${index + 1}: qué se midió`}
              disabled={disabled}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
              disabled={disabled}
              aria-label={`Quitar medida ${index + 1}`}
              className="shrink-0"
            >
              <X className="size-5" />
            </Button>
          </div>
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <Input
              value={measure.value}
              onChange={(event) => update(index, { value: event.target.value })}
              inputMode="decimal"
              placeholder="Cantidad"
              aria-label={`Medida ${index + 1}: cantidad`}
              disabled={disabled}
            />
            <Input
              value={measure.unit}
              onChange={(event) => update(index, { unit: event.target.value })}
              list="unidades"
              placeholder="Unidad"
              aria-label={`Medida ${index + 1}: unidad`}
              disabled={disabled}
            />
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={add} disabled={disabled}>
        <Plus className="size-5" />
        Agregar medida
      </Button>
    </div>
  );
}
