from odoo import fields, models

from .constants import FUENTES_GASTO, PARTIDAS


class AccountAnalyticLine(models.Model):
    """Gasto real del proyecto, partida por partida. [R-04]

    Hay dos clases de línea:

    * Mano de obra: parte de horas de verdad (`project_id` + `employee_id`),
      derivada de la asistencia. Odoo calcula el importe con `hourly_cost`.
    * Todo lo demás (compra, gasto de campo, manual, faltante): línea directa
      sobre la cuenta analítica del proyecto, sin `project_id`, porque
      `hr_timesheet` trata cualquier línea con proyecto como parte de horas y
      le exige empleado.

    `x_project_id` existe para poder consultar las dos de un solo golpe.
    """

    _inherit = "account.analytic.line"

    x_project_id = fields.Many2one(
        "project.project", string="Proyecto (Altitud)", index=True, ondelete="cascade"
    )
    x_partida = fields.Selection(PARTIDAS, string="Partida", index=True)
    x_source = fields.Selection(FUENTES_GASTO, string="Origen del gasto", index=True)
    x_attendance_id = fields.Many2one(
        "hr.attendance", string="Asistencia", index=True, ondelete="cascade"
    )
    x_registered_by = fields.Char(string="Registró")
    x_captured_by = fields.Char(string="Capturó en sitio")
    x_has_receipt = fields.Boolean(string="Con comprobante")
