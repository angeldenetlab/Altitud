from odoo import api, fields, models
from odoo.exceptions import ValidationError


class AltitudCrew(models.Model):
    """Cuadrilla: quién del padrón presta servicio en un proyecto.

    Es el permiso para marcar asistencia. Un empleado puede estar en varias
    obras; sacarlo de una no borra las asistencias que ya tiene.
    """

    _name = "altitud.crew"
    _description = "Cuadrilla del proyecto"
    _rec_name = "employee_id"
    _order = "project_id, employee_id"

    project_id = fields.Many2one(
        "project.project", string="Proyecto", required=True, ondelete="cascade", index=True
    )
    employee_id = fields.Many2one(
        "hr.employee", string="Colaborador", required=True, ondelete="cascade", index=True
    )
    active = fields.Boolean(default=True)
    date_from = fields.Date(string="Desde", default=fields.Date.context_today)
    note = fields.Char(string="Nota")

    _sql_constraints = [
        (
            "project_employee_uniq",
            "unique(project_id, employee_id)",
            "El colaborador ya está en la cuadrilla de este proyecto.",
        )
    ]

    @api.constrains("employee_id", "project_id")
    def _check_company(self):
        """La cuadrilla tiene que ser de la razón social del proyecto.

        No es un capricho: la parte de horas que genera la asistencia toma la
        compañía del empleado, y Odoo rechaza una parte de horas cuyo empleado
        y proyecto no coinciden. Se avisa aquí, al armar la cuadrilla, y no
        al final del día cuando el supervisor ya está marcando asistencia.
        """
        for crew in self:
            employee_company = crew.employee_id.company_id
            project_company = crew.project_id.company_id
            if employee_company and project_company and employee_company != project_company:
                raise ValidationError(
                    f"{crew.employee_id.name} es de {employee_company.name} y el proyecto "
                    f"{crew.project_id.x_folio or crew.project_id.name} es de "
                    f"{project_company.name}. La cuadrilla tiene que ser de la misma razón "
                    "social, porque de ahí sale el costo de mano de obra."
                )
