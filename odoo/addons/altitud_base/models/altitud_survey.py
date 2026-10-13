from odoo import api, fields, models
from odoo.exceptions import UserError

from .constants import AREAS


class AltitudSurvey(models.Model):
    """Levantamiento de sitio. No es el proyecto ni la cotización.

    Oficina lo abre con nombre, ubicación y empleado asignado. El portal de
    levantamientos (otro front, no el BFF) llena después la captura común.
    La cotización sale de aquí; el proyecto nace al confirmar la venta.
    """

    _name = "altitud.survey"
    _description = "Levantamiento"
    _order = "id desc"
    _rec_names_search = ["name", "folio", "sitio"]

    folio = fields.Char(string="Folio", index=True, copy=False, readonly=True)
    name = fields.Char(string="Nombre del trabajo", required=True)
    sitio = fields.Char(string="Ubicación", required=True)
    employee_id = fields.Many2one(
        "hr.employee",
        string="Empleado asignado",
        required=True,
        ondelete="restrict",
        index=True,
    )
    partner_id = fields.Many2one(
        "res.partner",
        string="Cliente",
        check_company=True,
        ondelete="set null",
        index=True,
    )
    area = fields.Selection(AREAS, string="Área")
    company_id = fields.Many2one(
        "res.company",
        string="Razón social",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    state = fields.Selection(
        [
            ("abierto", "Abierto"),
            ("listo", "Listo"),
        ],
        string="Estado",
        default="abierto",
        required=True,
        index=True,
        help="Abierto: oficina ya lo creó y la captura del sitio sigue pendiente. "
        "Listo: el sitio ya está capturado y se puede cotizar.",
    )
    sale_order_id = fields.Many2one(
        "sale.order",
        string="Cotización",
        copy=False,
        readonly=True,
        index=True,
        ondelete="set null",
    )

    # Captura del portal. No bloquean el alta de oficina.
    description = fields.Text(string="Descripción")
    floor_count = fields.Integer(string="Número de plantas")
    measurements = fields.Text(
        string="Medidas",
        help="JSON: [{label, value, unit}]",
    )
    site_conditions = fields.Text(string="Condiciones del sitio")
    survey_date = fields.Date(string="Fecha del levantamiento")
    surveyed_by_id = fields.Many2one(
        "hr.employee",
        string="Levantó",
        ondelete="set null",
    )
    photo_ids = fields.Many2many(
        "ir.attachment",
        "altitud_survey_photo_rel",
        "survey_id",
        "attachment_id",
        string="Fotografías",
    )

    _sql_constraints = [
        ("folio_uniq", "unique(folio)", "Ese folio de levantamiento ya existe."),
    ]

    @api.depends("folio", "name")
    def _compute_display_name(self):
        for survey in self:
            if survey.folio and survey.name:
                survey.display_name = f"{survey.folio} · {survey.name}"
            else:
                survey.display_name = survey.name or survey.folio or ""

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if not vals.get("folio"):
                vals["folio"] = self.env["ir.sequence"].next_by_code("altitud.survey") or "/"
        surveys = super().create(vals_list)
        surveys._bind_photos()
        return surveys

    def write(self, vals):
        res = super().write(vals)
        if "photo_ids" in vals:
            self._bind_photos()
        return res

    def _bind_photos(self):
        """Las fotos quedan como adjuntos de este levantamiento."""
        for survey in self:
            loose = survey.photo_ids.filtered(lambda attachment: not attachment.res_model)
            if loose:
                loose.write({"res_model": survey._name, "res_id": survey.id})

    def _action_open_quote(self, order):
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "name": "Cotización",
            "res_model": "sale.order",
            "view_mode": "form",
            "views": [(False, "form")],
            "res_id": order.id,
            "target": "current",
        }

    def action_generate_quote(self):
        """Crea la cotización en borrador, o abre la que ya existe.

        No confirma el pedido y no crea proyecto. El proyecto lo abre
        sale_project al confirmar, si el servicio lo pide.
        """
        self.ensure_one()
        order = self.sale_order_id
        if not order:
            order = self.env["sale.order"].search([("x_survey_id", "=", self.id)], limit=1)
            if order:
                self.sale_order_id = order
        if order:
            return self._action_open_quote(order)
        if not self.partner_id:
            raise UserError(
                "Hace falta el cliente para generar la cotización. "
                "El alta del levantamiento no lo pide; la cotización sí."
            )
        folio = self.env["ir.sequence"].with_company(self.company_id).next_by_code("altitud.quote")
        if not folio:
            raise UserError(
                "No hay secuencia de cotización (altitud.quote) para esta razón social."
            )
        order = self.env["sale.order"].with_company(self.company_id).create(
            {
                "name": folio,
                "x_folio": folio,
                "x_title": self.name,
                "partner_id": self.partner_id.id,
                "company_id": self.company_id.id,
                "x_survey_id": self.id,
                "x_origin": "levantamiento",
                "x_area": self.area or False,
                "origin": self.folio,
            }
        )
        self.sale_order_id = order
        return self._action_open_quote(order)
