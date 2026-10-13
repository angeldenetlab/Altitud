/**
 * Conexión al ERP.
 *
 * El portal habla con Odoo siempre con la misma cuenta técnica. La contraseña
 * de quien entra se usa una sola vez, en el login, para saber quién es.
 */

export interface OdooConfig {
  url: string;
  db: string;
  user: string;
  password: string;
}

function required(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa .env.local (ver .env.example).`);
  }
  return value.trim();
}

export function getOdooConfig(): OdooConfig {
  return {
    url: required("ODOO_URL", process.env.ODOO_URL).replace(/\/+$/, ""),
    db: required("ODOO_DB", process.env.ODOO_DB),
    // `ODOO_API_KEY` tiene prioridad sobre la contraseña: es lo que conviene
    // usar fuera de desarrollo.
    user: required("ODOO_USER", process.env.ODOO_USER),
    password: required(
      "ODOO_API_KEY u ODOO_PASSWORD",
      process.env.ODOO_API_KEY ?? process.env.ODOO_PASSWORD,
    ),
  };
}
