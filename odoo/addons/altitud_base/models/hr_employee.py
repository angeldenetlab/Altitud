from odoo import api, fields, models

from .constants import AREAS_CON_MIXTO, HORAS_JORNADA_DEFECTO, PARAM_HORAS_JORNADA


class HrEmployee(models.Model):
    """Colaborador operativo. El jornal es el costo de una jornada. [R-20]"""

    _inherit = "hr.employee"

    x_area = fields.Selection(AREAS_CON_MIXTO, string="Área", default="mixto", index=True)
    x_jornal = fields.Float(string="Jornal (día completo)")

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

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("x_jornal") and not vals.get("hourly_cost"):
                vals["hourly_cost"] = self._altitud_hourly_cost(vals["x_jornal"])
        return super().create(vals_list)

    def write(self, vals):
        if "x_jornal" in vals and "hourly_cost" not in vals:
            vals["hourly_cost"] = self._altitud_hourly_cost(vals["x_jornal"])
        return super().write(vals)
