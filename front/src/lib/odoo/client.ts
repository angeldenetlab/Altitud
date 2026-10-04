import { getOdooConfig } from "@/lib/odoo/config";

/**
 * Cliente JSON-RPC de Odoo.
 *
 * Todo pasa por `execute_kw`, igual que XML-RPC pero sobre JSON. El `uid` de
 * la cuenta técnica se resuelve una vez por proceso y se reutiliza.
 */

export class OdooError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "OdooError";
  }
}

interface RpcResponse<T> {
  result?: T;
  error?: {
    message?: string;
    data?: { message?: string; name?: string; arguments?: unknown[] };
  };
}

/** Errores de negocio de Odoo que son culpa del dato, no del servidor. */
const USER_ERRORS = new Set([
  "odoo.exceptions.ValidationError",
  "odoo.exceptions.UserError",
  "odoo.exceptions.RedirectWarning",
]);

async function rpc<T>(service: string, method: string, args: unknown[]): Promise<T> {
  const { url } = getOdooConfig();

  let response: Response;
  try {
    response = await fetch(`${url}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: { service, method, args },
      }),
      cache: "no-store",
    });
  } catch (error) {
    throw new OdooError(
      `No se pudo conectar con el ERP en ${url}. ${(error as Error).message}`,
      502,
    );
  }

  if (!response.ok) {
    throw new OdooError(`El ERP respondió ${response.status}.`, 502);
  }

  const payload = (await response.json()) as RpcResponse<T>;

  if (payload.error) {
    const data = payload.error.data;
    const message = data?.message?.trim() || payload.error.message || "Error del ERP.";
    const isUserError = data?.name ? USER_ERRORS.has(data.name) : false;
    throw new OdooError(message, isUserError ? 400 : 500, data);
  }

  return payload.result as T;
}

let uidPromise: Promise<number> | null = null;

/** `uid` de la cuenta técnica, resuelto una sola vez. */
export async function getUid(): Promise<number> {
  if (!uidPromise) {
    const { db, user, password } = getOdooConfig();
    uidPromise = rpc<number | false>("common", "authenticate", [db, user, password, {}]).then(
      (uid) => {
        if (!uid) {
          uidPromise = null;
          throw new OdooError(
            "El ERP rechazó las credenciales de la cuenta técnica (ODOO_USER / ODOO_API_KEY).",
            500,
          );
        }
        return uid;
      },
      (error) => {
        uidPromise = null;
        throw error;
      },
    );
  }
  return uidPromise;
}

/**
 * Valida usuario y contraseña contra `res.users`. Devuelve el `uid` o null.
 * Es lo único que usa las credenciales de quien entra. [R-33]
 */
export async function authenticate(login: string, password: string): Promise<number | null> {
  const { db } = getOdooConfig();
  const uid = await rpc<number | false>("common", "authenticate", [db, login, password, {}]);
  return uid === false ? null : uid;
}

export interface CallOptions {
  /** Contexto de Odoo. Las dos razones sociales van por defecto. */
  context?: Record<string, unknown>;
}

/** Llamada cruda a un método de modelo. */
export async function callKw<T>(
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {},
): Promise<T> {
  const { db, password } = getOdooConfig();
  const uid = await getUid();
  return rpc<T>("object", "execute_kw", [db, uid, password, model, method, args, kwargs]);
}

// ---------------------------------------------------------------------------
// Azúcar de ORM
// ---------------------------------------------------------------------------

export type Domain = unknown[];

export interface SearchReadOptions {
  fields?: string[];
  limit?: number;
  offset?: number;
  order?: string;
  context?: Record<string, unknown>;
}

export async function searchRead<T = Record<string, unknown>>(
  model: string,
  domain: Domain = [],
  options: SearchReadOptions = {},
): Promise<T[]> {
  const { fields, limit, offset, order, context } = options;
  return callKw<T[]>(model, "search_read", [domain], {
    ...(fields ? { fields } : {}),
    ...(limit ? { limit } : {}),
    ...(offset ? { offset } : {}),
    ...(order ? { order } : {}),
    context: withCompanies(context),
  });
}

export async function searchCount(model: string, domain: Domain = []): Promise<number> {
  return callKw<number>(model, "search_count", [domain], { context: withCompanies() });
}

export async function read<T = Record<string, unknown>>(
  model: string,
  ids: number[],
  fields: string[],
  context?: Record<string, unknown>,
): Promise<T[]> {
  if (ids.length === 0) return [];
  return callKw<T[]>(model, "read", [ids, fields], { context: withCompanies(context) });
}

export async function create(
  model: string,
  values: Record<string, unknown>,
  context?: Record<string, unknown>,
): Promise<number> {
  const ids = await callKw<number | number[]>(model, "create", [values], {
    context: withCompanies(context),
  });
  return Array.isArray(ids) ? ids[0] : ids;
}

export async function createMany(
  model: string,
  values: Record<string, unknown>[],
  context?: Record<string, unknown>,
): Promise<number[]> {
  if (values.length === 0) return [];
  const ids = await callKw<number | number[]>(model, "create", [values], {
    context: withCompanies(context),
  });
  return Array.isArray(ids) ? ids : [ids];
}

export async function write(
  model: string,
  ids: number[],
  values: Record<string, unknown>,
  context?: Record<string, unknown>,
): Promise<boolean> {
  if (ids.length === 0) return true;
  return callKw<boolean>(model, "write", [ids, values], { context: withCompanies(context) });
}

export async function unlink(model: string, ids: number[]): Promise<boolean> {
  if (ids.length === 0) return true;
  return callKw<boolean>(model, "unlink", [ids], { context: withCompanies() });
}

/**
 * Contexto por omisión de toda llamada.
 *
 * - Las dos razones sociales: el front filtra por compañía con su propio
 *   selector, no con el de Odoo. [R-37]
 * - Idioma fijo: las etiquetas que Odoo devuelve (nombres de campo del
 *   historial, selecciones) se enseñan tal cual en la bitácora, así que no
 *   pueden depender del idioma de la cuenta técnica.
 */
export function withCompanies(context: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...(allowedCompanyIds.length ? { allowed_company_ids: allowedCompanyIds } : {}),
    lang: "es_MX",
    ...context,
  };
}

/**
 * Ids de las razones sociales sobre las que opera el BFF.
 *
 * No se pueden dejar fijos en `[1, 2]`: los scripts de arranque se pueden
 * correr sobre una base nueva y las compañías caerían en otros ids. Con el
 * número equivocado, las reglas multicompañía de Odoo filtran proyectos
 * enteros sin decir nada. `getCompanies()` los resuelve y los registra aquí.
 */
let allowedCompanyIds: number[] = [];

export function setAllowedCompanies(ids: number[]) {
  allowedCompanyIds = ids;
}

// ---------------------------------------------------------------------------
// Utilidades de lectura
// ---------------------------------------------------------------------------

/** Un many2one llega como `[id, "nombre"]` o `false`. */
export type Many2One = [number, string] | false | null | undefined;

export function m2oId(value: Many2One): number | undefined {
  return Array.isArray(value) ? value[0] : undefined;
}

export function m2oName(value: Many2One): string | undefined {
  return Array.isArray(value) ? value[1] : undefined;
}
