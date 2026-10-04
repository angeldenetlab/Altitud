from odoo import fields, models

from .constants import PARTIDAS


class AltitudExtra(models.Model):
    """Lo que se ocupó de más o lo que no se contempló. [R-06]

    Un extra cobrable sube lo facturable y queda pendiente hasta que se le
    cotiza al cliente (`quote_folio`). Un faltante es costo: además genera su
    línea de gasto real.
    """

    _name = "altitud.extra"
    _description = "Extra o faltante del proyecto"
    _order = "date desc, id desc"

    project_id = fields.Many2one(
        "project.project", string="Proyecto", required=True, ondelete="cascade", index=True
    )
    kind = fields.Selection(
        [("extra", "Extra"), ("faltante", "Faltante")],
        string="Tipo",
        required=True,
        default="extra",
    )
    category = fields.Selection(PARTIDAS, string="Partida", required=True, default="materiales")
    concept = fields.Char(string="Concepto", required=True)
    amount = fields.Float(string="Importe")
    date = fields.Date(string="Fecha", default=fields.Date.context_today)
    billable = fields.Boolean(string="Cobrable al cliente")
    approved_by = fields.Char(string="Autorizó")
    quote_folio = fields.Char(string="Folio de cotización")
    analytic_line_id = fields.Many2one(
        "account.analytic.line",
        string="Gasto generado",
        ondelete="set null",
        help="Solo los faltantes generan gasto real.",
    )
