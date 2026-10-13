const TIMEZONE = "America/Mexico_City";

/** El día de hoy en el huso de la operación, como lo espera Odoo (YYYY-MM-DD). */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** `2026-10-10` → `10 oct 2026`. Sin hora: el levantamiento es por día. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  }).format(date);
}

/** Enlace a mapas con la ubicación que escribió oficina. */
export function mapsUrl(site: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site)}`;
}
