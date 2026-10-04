import type { ChatterActivity, ChatterMessage } from "@/types/altitude";
import { badRequest, json, notFound, type Payload, unknownAction } from "@/lib/http";
import { dayIso, num, str } from "@/lib/compute";
import type { SessionPayload } from "@/lib/auth/server-session";
import {
  type Many2One,
  callKw,
  create,
  m2oId,
  m2oName,
  searchRead,
  unlink,
} from "@/lib/odoo/client";
import { stripHtml } from "@/server/erp/common";

/**
 * Bitácora y actividades. Es el mecanismo con el que se delega una etapa: se
 * deja la nota, se programa la actividad y queda el rastro.
 *
 * El historial no se escribe a mano: Odoo ya trackea los cambios de los
 * campos marcados (etapa, precio de venta, estatus de la cotización) y aquí
 * se leen de `mail.tracking.value`. Las notas sí se publican.
 */

const MODEL_MAP: Record<string, string> = {
  project: "project.project",
  quote: "sale.order",
  client: "res.partner",
};

export function odooModelOf(model: string | undefined): string | undefined {
  return model ? MODEL_MAP[model] : undefined;
}

export function frontModelOf(odooModel: string): string {
  const entry = Object.entries(MODEL_MAP).find(([, value]) => value === odooModel);
  return entry ? entry[0] : odooModel;
}

// ---------------------------------------------------------------------------
// Escritura (la usan también proyectos y cotizaciones)
// ---------------------------------------------------------------------------

/** Publica una nota en el hilo del registro, firmada por quien la escribe. */
export async function postNote(
  odooModel: string,
  resId: number,
  body: string,
  session?: SessionPayload,
): Promise<void> {
  const authorId = session ? await partnerIdOfUser(session.uid) : undefined;
  await callKw(odooModel, "message_post", [[resId]], {
    body,
    message_type: "comment",
    subtype_xmlid: "mail.mt_note",
    ...(authorId ? { author_id: authorId } : {}),
  });
}

const partnerCache = new Map<number, number | undefined>();

export async function partnerIdOfUser(uid: number): Promise<number | undefined> {
  if (partnerCache.has(uid)) return partnerCache.get(uid);
  const rows = await searchRead<{ id: number; partner_id: Many2One }>(
    "res.users",
    [["id", "=", uid]],
    { fields: ["id", "partner_id"] },
  );
  const partnerId = m2oId(rows[0]?.partner_id);
  partnerCache.set(uid, partnerId);
  return partnerId;
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

interface OdooMessage {
  id: number;
  body: string | false;
  date: string;
  author_id: Many2One;
  message_type: string;
  subtype_id: Many2One;
  tracking_value_ids: number[];
}

interface OdooTracking {
  id: number;
  mail_message_id: Many2One;
  field_id: Many2One;
  field_info: { desc?: string; type?: string } | false;
  old_value_char: string | false;
  new_value_char: string | false;
  old_value_text: string | false;
  new_value_text: string | false;
  old_value_float: number | false;
  new_value_float: number | false;
  old_value_integer: number | false;
  new_value_integer: number | false;
  old_value_datetime: string | false;
  new_value_datetime: string | false;
}

function trackingSide(row: OdooTracking, side: "old" | "new"): string {
  const char = side === "old" ? row.old_value_char : row.new_value_char;
  if (char) return char;
  const text = side === "old" ? row.old_value_text : row.new_value_text;
  if (text) return text;
  const float = side === "old" ? row.old_value_float : row.new_value_float;
  if (typeof float === "number" && float !== 0) return float.toFixed(2);
  const integer = side === "old" ? row.old_value_integer : row.new_value_integer;
  if (typeof integer === "number" && integer !== 0) return String(integer);
  const datetime = side === "old" ? row.old_value_datetime : row.new_value_datetime;
  if (datetime) return datetime.slice(0, 10);
  return "—";
}

/**
 * Nombre del campo que cambió.
 *
 * `field_info` solo se llena dentro de Odoo; por RPC llega vacío. El nombre
 * sí viaja en `field_id`, con el modelo entre paréntesis («Etapa (Project)»),
 * que aquí sobra.
 */
function trackingFieldLabel(row: OdooTracking): string {
  if (row.field_info && row.field_info.desc) return row.field_info.desc;
  const label = m2oName(row.field_id);
  if (!label) return "Campo";
  return label.replace(/\s*\([^()]*\)\s*$/, "").trim() || label;
}

async function readMessages(odooModel: string, resId: number): Promise<ChatterMessage[]> {
  const messages = await searchRead<OdooMessage>(
    "mail.message",
    [
      ["model", "=", odooModel],
      ["res_id", "=", resId],
      ["message_type", "in", ["comment", "notification"]],
    ],
    {
      fields: ["id", "body", "date", "author_id", "message_type", "subtype_id", "tracking_value_ids"],
      order: "date desc, id desc",
      limit: 100,
    },
  );

  const trackingIds = messages.flatMap((message) => message.tracking_value_ids);
  const tracking = trackingIds.length
    ? await searchRead<OdooTracking>("mail.tracking.value", [["id", "in", trackingIds]], {
        fields: [
          "id",
          "mail_message_id",
          "field_id",
          "field_info",
          "old_value_char",
          "new_value_char",
          "old_value_text",
          "new_value_text",
          "old_value_float",
          "new_value_float",
          "old_value_integer",
          "new_value_integer",
          "old_value_datetime",
          "new_value_datetime",
        ],
      })
    : [];

  const trackingByMessage = new Map<number, ChatterMessage["tracking"]>();
  tracking.forEach((row) => {
    const messageId = m2oId(row.mail_message_id) ?? 0;
    const list = trackingByMessage.get(messageId) ?? [];
    list.push({
      field: trackingFieldLabel(row),
      old_value: trackingSide(row, "old"),
      new_value: trackingSide(row, "new"),
    });
    trackingByMessage.set(messageId, list);
  });

  return messages
    .map((message) => ({
      id: message.id,
      body: stripHtml(message.body) ?? "",
      date: message.date.slice(0, 16),
      author: m2oName(message.author_id) ?? "Sistema",
      is_note: true,
      tracking: trackingByMessage.get(message.id) ?? [],
    }))
    .filter((message) => message.body || message.tracking.length > 0);
}

interface OdooActivity {
  id: number;
  summary: string | false;
  note: string | false;
  date_deadline: string;
  state: string;
  activity_type_id: Many2One;
  user_id: Many2One;
  res_model: string;
  res_id: number;
  res_name: string | false;
}

function toActivity(row: OdooActivity): ChatterActivity {
  return {
    id: row.id,
    summary: row.summary || m2oName(row.activity_type_id) || "Actividad",
    note: stripHtml(row.note),
    date_deadline: row.date_deadline,
    state: row.state,
    activity_type: m2oName(row.activity_type_id) ?? "Actividad",
    user_name: m2oName(row.user_id) ?? "Sin responsable",
    res_model: frontModelOf(row.res_model),
    res_id: row.res_id,
    res_name: row.res_name || undefined,
  };
}

const ACTIVITY_FIELDS = [
  "id",
  "summary",
  "note",
  "date_deadline",
  "state",
  "activity_type_id",
  "user_id",
  "res_model",
  "res_id",
  "res_name",
];

async function readActivities(odooModel: string, resId: number): Promise<ChatterActivity[]> {
  const rows = await searchRead<OdooActivity>(
    "mail.activity",
    [
      ["res_model", "=", odooModel],
      ["res_id", "=", resId],
    ],
    { fields: ACTIVITY_FIELDS, order: "date_deadline" },
  );
  return rows.map(toActivity);
}

// ---------------------------------------------------------------------------
// Despachador
// ---------------------------------------------------------------------------

export async function handleChatter(
  action: string,
  payload: Payload,
  session: SessionPayload,
) {
  switch (action) {
    case "messages": {
      const odooModel = odooModelOf(str(payload.model));
      const resId = num(payload.res_id);
      if (!odooModel || !resId) return json({ rows: [] });
      return json({ rows: await readMessages(odooModel, resId) });
    }

    case "post": {
      const odooModel = odooModelOf(str(payload.model));
      const resId = num(payload.res_id);
      const body = str(payload.body);
      if (!odooModel || !resId) return badRequest("Registro inválido.");
      if (!body) return badRequest("Escribe una nota.");

      await postNote(odooModel, resId, body, session);
      return json({ rows: await readMessages(odooModel, resId) });
    }

    case "activities": {
      const odooModel = odooModelOf(str(payload.model));
      const resId = num(payload.res_id);
      if (!odooModel || !resId) return json({ rows: [] });
      return json({ rows: await readActivities(odooModel, resId) });
    }

    case "activityTypes": {
      const rows = await searchRead<{ id: number; name: string }>("mail.activity.type", [], {
        fields: ["id", "name"],
        order: "sequence, id",
      });
      return json({ rows });
    }

    case "users": {
      const rows = await searchRead<{ id: number; name: string; x_app_role: string | false }>(
        "res.users",
        [["share", "=", false]],
        { fields: ["id", "name", "x_app_role"], order: "name" },
      );
      return json({
        rows: rows.map((row) => ({
          id: row.id,
          name: row.name,
          role: row.x_app_role || "control",
        })),
      });
    }

    /** Programar una actividad = delegar el siguiente paso de la etapa. */
    case "schedule": {
      const frontModel = str(payload.model);
      const odooModel = odooModelOf(frontModel);
      const resId = num(payload.res_id);
      if (!odooModel || !resId) return badRequest("Registro inválido.");

      const deadline = str(payload.date_deadline) ?? dayIso(1);
      let typeId = num(payload.activity_type_id, 0);
      if (!typeId) {
        const fallback = await searchRead<{ id: number }>("mail.activity.type", [], {
          fields: ["id"],
          limit: 1,
          order: "sequence, id",
        });
        typeId = fallback[0]?.id ?? 0;
      }

      await create("mail.activity", {
        res_model: odooModel,
        res_model_id: await modelIdOf(odooModel),
        res_id: resId,
        activity_type_id: typeId || false,
        summary: str(payload.summary) ?? "",
        note: str(payload.note) ?? "",
        date_deadline: deadline,
        user_id: num(payload.user_id, session.uid) || session.uid,
      });

      return json({ rows: await readActivities(odooModel, resId) });
    }

    case "done": {
      const id = num(payload.id);
      const rows = await searchRead<OdooActivity>("mail.activity", [["id", "=", id]], {
        fields: [...ACTIVITY_FIELDS, "user_id"],
      });
      if (rows.length === 0) return notFound("La actividad ya no existe.");

      // Cerrar una actividad es cerrarla para quien la tiene asignada. Sin
      // esto, cualquiera con acceso al panel podría tachar los pendientes de
      // otro, que es justo lo que la campana sirve para evitar.
      const owner = m2oId(rows[0].user_id);
      if (owner && owner !== session.uid) {
        return badRequest("Esa actividad está asignada a otra persona.");
      }

      const feedback = str(payload.note) ?? "Hecho";
      try {
        await callKw("mail.activity", "action_feedback", [[id]], { feedback });
      } catch {
        // Si la actividad ya no se puede cerrar por el flujo nativo, se borra
        // y se deja la nota a mano: el hilo no se queda sin rastro.
        await postNote(rows[0].res_model, rows[0].res_id, `${rows[0].summary} — ${feedback}`, session);
        await unlink("mail.activity", [id]);
      }
      return json({ ok: true });
    }

    /** Campanita: los pendientes del usuario en sesión. */
    case "notifications": {
      const rows = await searchRead<OdooActivity>(
        "mail.activity",
        [["user_id", "=", session.uid]],
        { fields: ACTIVITY_FIELDS, order: "date_deadline" },
      );
      const activities = rows.map(toActivity);
      return json({
        activities,
        overdue: activities.filter((activity) => activity.state === "overdue").length,
        today: activities.filter((activity) => activity.state === "today").length,
        planned: activities.filter((activity) => activity.state === "planned").length,
        total: activities.length,
      });
    }

    default:
      return unknownAction(action);
  }
}

const modelIdCache = new Map<string, number>();

async function modelIdOf(odooModel: string): Promise<number | false> {
  const cached = modelIdCache.get(odooModel);
  if (cached) return cached;
  const rows = await searchRead<{ id: number }>("ir.model", [["model", "=", odooModel]], {
    fields: ["id"],
    limit: 1,
  });
  if (rows[0]) {
    modelIdCache.set(odooModel, rows[0].id);
    return rows[0].id;
  }
  return false;
}
