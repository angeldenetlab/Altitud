import { getOdooConfig } from "@/lib/odoo/config";

/**
 * Cliente JSON-RPC de Odoo.
 *
 * Todo pasa por `execute_kw`. El `uid` de la cuenta técnica se resuelve una
 * vez por proceso y se reutiliza.
 */

export class OdooError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
  ) {
    super(message);
    this.name = "OdooError";
  }
}

interface RpcResponse<T> {
  result?: T;
  error?: {
    message?: string;
    data?: { message?: string; name?: string };
  };
}

/** Errores de negocio de Odoo: son culpa del dato, no del servidor. */
const USER_ERRORS = new Set([
  "odoo.exceptions.ValidationError",
  "odoo.exceptions.UserError",
  "odoo.exceptions.AccessError",
  "odoo.exceptions.RedirectWarning",
]);

async function rpc<T>(service: string, method: string, args: unknown[]): Promise<T> {
  const { url } = getOdooConfig();

  let response: Response;
  try {
    response = await fetch(`${url}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args } }),
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
    throw new OdooError(message, isUserError ? 400 : 500);
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
 * Es lo único que usa las credenciales de quien entra.
 */
export async function authenticate(login: string, password: string): Promise<number | null> {
  const { db } = getOdooConfig();
  const uid = await rpc<number | false>("common", "authenticate", [db, login, password, {}]);
  return uid === false ? null : uid;
}

let companyIdsPromise: Promise<number[]> | null = null;

/** Las razones sociales reales de la base. Los ids no están fijos. */
async function getCompanyIds(): Promise<number[]> {
  if (!companyIdsPromise) {
    companyIdsPromise = callKwRaw<number[]>("res.company", "search", [[]], {}).catch((error) => {
      companyIdsPromise = null;
      throw error;
    });
  }
  return companyIdsPromise;
}

async function callKwRaw<T>(
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown>,
): Promise<T> {
  const { db, password } = getOdooConfig();
  const uid = await getUid();
  return rpc<T>("object", "execute_kw", [db, uid, password, model, method, args, kwargs]);
}

/** Contexto común: las dos razones sociales, idioma y huso de la operación. */
async function withCompanies(
  context: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  return {
    allowed_company_ids: await getCompanyIds(),
    lang: "es_MX",
    tz: "America/Mexico_City",
    ...context,
  };
}

export type Domain = unknown[];

export interface SearchReadOptions {
  fields?: string[];
  limit?: number;
  order?: string;
}

export async function searchRead<T = Record<string, unknown>>(
  model: string,
  domain: Domain = [],
  options: SearchReadOptions = {},
): Promise<T[]> {
  const { fields, limit, order } = options;
  return callKwRaw<T[]>(model, "search_read", [domain], {
    ...(fields ? { fields } : {}),
    ...(limit ? { limit } : {}),
    ...(order ? { order } : {}),
    context: await withCompanies(),
  });
}

export async function read<T = Record<string, unknown>>(
  model: string,
  ids: number[],
  fields: string[],
): Promise<T[]> {
  if (ids.length === 0) return [];
  return callKwRaw<T[]>(model, "read", [ids, fields], { context: await withCompanies() });
}

export async function create(
  model: string,
  values: Record<string, unknown>,
): Promise<number> {
  const ids = await callKwRaw<number | number[]>(model, "create", [values], {
    context: await withCompanies(),
  });
  return Array.isArray(ids) ? ids[0] : ids;
}

export async function write(
  model: string,
  ids: number[],
  values: Record<string, unknown>,
): Promise<boolean> {
  if (ids.length === 0) return true;
  return callKwRaw<boolean>(model, "write", [ids, values], { context: await withCompanies() });
}

export async function unlink(model: string, ids: number[]): Promise<boolean> {
  if (ids.length === 0) return true;
  return callKwRaw<boolean>(model, "unlink", [ids], { context: await withCompanies() });
}
