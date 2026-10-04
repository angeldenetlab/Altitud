from odoo import api, fields, models

from .constants import PARTIDAS


class AltitudBudgetLine(models.Model):
    """Renglón del presupuesto base, partida por partida. [R-03]

    Odoo no trae un presupuesto con cantidad y costo unitario fuera de
    Enterprise, y el comparativo del proyecto lo necesita así.
    """

    _name = "altitud.budget.line"
    _description = "Partida del presupuesto"
    _order = "project_id, sequence, id"

    project_id = fields.Many2one(
        "project.project", string="Proyecto", required=True, ondelete="cascade", index=True
    )
    sequence = fields.Integer(default=10)
    category = fields.Selection(PARTIDAS, string="Partida", required=True, default="materiales")
    concept = fields.Char(string="Concepto", required=True)
    unit = fields.Char(string="Unidad", default="lote")
    qty = fields.Float(string="Cantidad", default=1.0)
    unit_cost = fields.Float(string="Costo unitario", default=0.0)
    amount = fields.Float(string="Importe", compute="_compute_amount", store=True)
    notes = fields.Char(string="Notas")

    @api.depends("qty", "unit_cost")
    def _compute_amount(self):
        for line in self:
            line.amount = line.qty * line.unit_cost
