const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatCurrency(value: number | null | undefined): string {
  return currencyFormatter.format(value ?? 0);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value.includes(" ") ? value.replace(" ", "T") : value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return dateFormatter.format(parsed);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value.includes(" ") ? value.replace(" ", "T") : value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return dateTimeFormatter.format(parsed);
}

/**
 * Odoo suele devolver relaciones many2one como `[id, "Nombre"]` o `false`
 * cuando están vacías.
 */
export function m2oLabel(
  value: [number, string] | false | null | undefined
): string {
  if (!value) return "—";
  return value[1];
}

export function m2oId(
  value: [number, string] | false | null | undefined
): number | null {
  if (!value) return null;
  return value[0];
}
