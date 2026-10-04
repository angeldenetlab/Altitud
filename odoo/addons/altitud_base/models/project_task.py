from odoo import fields, models


class ProjectTask(models.Model):
    """Fase del proyecto con su peso y avance. [R-05] [R-28]

    El avance se captura; no sale de las horas. El `progress` nativo se
    calcula contra horas planeadas y aquí no significa nada.
    """

    _inherit = "project.task"

    x_weight = fields.Float(string="Peso sobre el avance", default=0.0)
    x_progress = fields.Float(string="Avance capturado (%)", default=0.0)
    x_done_date = fields.Date(string="Terminada el")
    x_assignee = fields.Char(string="Responsable en obra")
    x_is_phase = fields.Boolean(string="Es fase del proyecto", default=True, index=True)
