import { NextResponse } from "next/server";
import { OdooError } from "@/lib/odoo/client";

/** Cuerpo de las llamadas de dominio: POST { action, payload }. */
export type Payload = Record<string, unknown>;

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function notFound(message = "Registro no encontrado.") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function unknownAction(action: string) {
  return NextResponse.json({ error: `Acción "${action}" no disponible.` }, { status: 400 });
}

/**
 * Traduce un error al cuerpo que ya entiende el front (`{ error }`).
 *
 * Los errores de validación de Odoo son del dato, no del servidor: llegan
 * como 400 con el texto que escribió el modelo, para que el usuario lo lea.
 */
export function erpError(scope: string, error: unknown) {
  if (error instanceof OdooError) {
    if (error.status >= 500) console.error(`[${scope}]`, error);
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(`[${scope}]`, error);
  return NextResponse.json({ error: "No se pudo procesar la solicitud." }, { status: 500 });
}
