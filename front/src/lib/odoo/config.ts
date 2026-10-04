/**
 * Conexión al ERP.
 *
 * El BFF habla con Odoo siempre con la misma cuenta técnica. La sesión del
 * usuario se valida contra `res.users` al entrar (ver `/api/auth/login`), y
 * los permisos se exigen en cada Route Handler con la matriz de
 * `src/lib/auth/rbac.ts`. [R-33]
 */

export interface OdooConfig {
  url: string;
  db: string;
  user: string;
  password: string;
}

function required(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(
      `Falta la variable de entorno ${name}. Revisa el .env del front (ver .env.example).`,
    );
  }
  return value.trim();
}

export function getOdooConfig(): OdooConfig {
  return {
    url: required("ODOO_URL", process.env.ODOO_URL).replace(/\/+$/, ""),
    db: required("ODOO_DB", process.env.ODOO_DB),
    // La cuenta técnica del BFF. `ODOO_API_KEY` tiene prioridad sobre la
    // contraseña: es lo que conviene usar fuera de desarrollo.
    user: required("ODOO_USER", process.env.ODOO_USER),
    password: required(
      "ODOO_API_KEY u ODOO_PASSWORD",
      process.env.ODOO_API_KEY ?? process.env.ODOO_PASSWORD,
    ),
  };
}

export function isErpConfigured(): boolean {
  return Boolean(
    process.env.ODOO_URL &&
      process.env.ODOO_DB &&
      process.env.ODOO_USER &&
      (process.env.ODOO_API_KEY ?? process.env.ODOO_PASSWORD),
  );
}
