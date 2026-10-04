/**
 * Odoo guarda las fechas con hora en UTC. La jornada de Altitud se ancla a
 * las 08:00 locales, así que una asistencia del 1 de octubre puede estar
 * guardada como `2026-10-01 14:00:00`.
 *
 * Nunca se recorta `check_in` a 10 caracteres para sacar el día: hay que
 * convertir al huso de la operación primero, o las jornadas de la tarde se
 * cuentan en el día equivocado.
 */

export const OPERATION_TZ = "America/Mexico_City";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: OPERATION_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: OPERATION_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Un datetime de Odoo (UTC, `YYYY-MM-DD HH:mm:ss`) → día local `YYYY-MM-DD`. */
export function localDayOf(odooDatetime: string): string {
  const date = new Date(`${odooDatetime.replace(" ", "T")}Z`);
  return dayFormatter.format(date);
}

/**
 * La hora de ese mismo datetime, ya en el huso de la operación (`HH:mm`).
 *
 * Recortar los caracteres 11 a 16 de la cadena enseñaría la hora UTC: toda
 * jornada completa se vería como «14:00», que es su hora en Londres, no la
 * entrada de las 08:00 que capturó el supervisor.
 */
export function localTimeOf(odooDatetime: string): string {
  const date = new Date(`${odooDatetime.replace(" ", "T")}Z`);
  return timeFormatter.format(date);
}

/**
 * Rango UTC que cubre con holgura los días locales pedidos.
 *
 * Se abre un día de más por lado: el filtro fino se hace después en JS con
 * `localDayOf`, que es el que sabe de husos y horarios de verano.
 */
export function utcRangeForDays(from: string, to: string): [string, string] {
  const start = new Date(`${from}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(`${to}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return [`${start.toISOString().slice(0, 10)} 00:00:00`, `${end.toISOString().slice(0, 10)} 23:59:59`];
}
