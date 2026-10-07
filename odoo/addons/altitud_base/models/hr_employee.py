from odoo import api, fields, models
from odoo.exceptions import ValidationError

from .constants import AREAS_CON_MIXTO, HORAS_JORNADA_DEFECTO, PARAM_HORAS_JORNADA


class HrEmployee(models.Model):
    """Colaborador operativo. El jornal es el costo de una jornada. [R-20]"""

    _inherit = "hr.employee"

    x_area = fields.Selection(AREAS_CON_MIXTO, string="Área", default="mixto", index=True)
    x_jornal = fields.Float(string="Jornal (día completo)")
    x_telegram_chat_id = fields.Char(
        string="Chat de Telegram",
        index=True,
        copy=False,
        help="Identidad del bot. El nombre de Telegram no cuenta: se liga el chat.",
    )

    _sql_constraints = [
        (
            "telegram_chat_uniq",
            "unique(x_telegram_chat_id)",
            "Ese chat de Telegram ya está ligado a otro colaborador.",
        )
    ]

    @api.onchange("x_jornal")
    def _onchange_x_jornal(self):
        """`hourly_cost` es lo que Odoo usa para costear la parte de horas."""
        for employee in self:
            employee.hourly_cost = employee._altitud_hourly_cost(employee.x_jornal)

    @api.model
    def _altitud_hourly_cost(self, jornal):
        param = self.env["ir.config_parameter"].sudo().get_param(PARAM_HORAS_JORNADA)
        try:
            horas = float(param) if param else HORAS_JORNADA_DEFECTO
        except (TypeError, ValueError):
            horas = HORAS_JORNADA_DEFECTO
        return (jornal or 0.0) / (horas or 1.0)

    @api.model
    def _altitud_norm_telegram(self, vals):
        if "x_telegram_chat_id" not in vals:
            return vals
        raw = vals.get("x_telegram_chat_id")
        chat = str(raw).strip() if raw else ""
        if not chat or chat in ("False", "0"):
            vals["x_telegram_chat_id"] = False
        else:
            vals["x_telegram_chat_id"] = chat
        return vals

    @api.model
    def altitud_por_telegram(self, chat_id):
        """Identifica al colaborador por el chat. Sin chat ligado no hay captura."""
        chat = str(chat_id).strip() if chat_id else ""
        if not chat or chat in ("False", "0"):
            return self.browse()
        return self.search([("x_telegram_chat_id", "=", chat)], limit=1)

    @api.model
    def _altitud_resolver(self, employee_id=None, chat_id=None):
        if chat_id:
            employee = self.altitud_por_telegram(chat_id)
            if not employee:
                raise ValidationError(
                    "Este chat de Telegram no está ligado a un colaborador."
                )
            return employee
        if employee_id:
            employee = self.browse(int(employee_id))
            if not employee.exists():
                raise ValidationError("El colaborador no existe.")
            return employee
        raise ValidationError("Falta el colaborador o el chat de Telegram.")

    def altitud_ligar_telegram(self, chat_id):
        """Primer contacto: el chat queda ligado a este colaborador."""
        self.ensure_one()
        chat = str(chat_id).strip() if chat_id else ""
        if not chat or chat in ("False", "0"):
            raise ValidationError("Falta el identificador del chat.")
        other = self.search(
            [("x_telegram_chat_id", "=", chat), ("id", "!=", self.id)], limit=1
        )
        if other:
            raise ValidationError(f"Ese chat ya está ligado a {other.name}.")
        self.x_telegram_chat_id = chat
        return True

    @api.model
    def altitud_obras_telegram(self, chat_id):
        """Obras de la cuadrilla activa de quien escribe. Vacío si el chat no está ligado."""
        employee = self.altitud_por_telegram(chat_id)
        if not employee:
            return []
        return employee.altitud_obras_activas()

    def altitud_obras_activas(self):
        """Obras donde este colaborador tiene cuadrilla activa. El bot elige entre ellas."""
        self.ensure_one()
        crews = self.env["altitud.crew"].search(
            [("employee_id", "=", self.id), ("active", "=", True)]
        )
        obras = []
        for crew in crews:
            project = crew.project_id
            if not project:
                continue
            if (project.stage_id.x_code or "") in ("cerrado", "perdido"):
                continue
            obras.append(
                {
                    "id": project.id,
                    "folio": project.x_folio or "",
                    "name": project.name,
                }
            )
        return obras

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            self._altitud_norm_telegram(vals)
            if vals.get("x_jornal") and not vals.get("hourly_cost"):
                vals["hourly_cost"] = self._altitud_hourly_cost(vals["x_jornal"])
        return super().create(vals_list)

    def write(self, vals):
        self._altitud_norm_telegram(vals)
        if "x_jornal" in vals and "hourly_cost" not in vals:
            vals["hourly_cost"] = self._altitud_hourly_cost(vals["x_jornal"])
        return super().write(vals)
