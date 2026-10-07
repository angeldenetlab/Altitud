from odoo import api, fields, models
from odoo.exceptions import ValidationError

from .constants import FUENTES_GASTO, PARTIDAS

PARTIDA_KEYS = {key for key, _label in PARTIDAS}


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

    @api.model
    def altitud_gasto_campo(
        self,
        project_id,
        amount,
        employee_id=None,
        chat_id=None,
        concept=None,
        category=None,
        date=None,
        captured_by=None,
        photo_name=None,
        photo_data=None,
        photo_mimetype=None,
        has_receipt=None,
    ):
        """Crea el gasto de campo `GC-…` y, si viene, cuelga la foto del ticket.

        El importe entra negativo. La línea lleva `x_project_id` y la cuenta
        analítica, y no lleva `project_id`: si lo llevara, `hr_timesheet` la
        trataría como parte de horas.

        Con chat o colaborador, el proyecto tiene que ser de su cuadrilla
        activa. Sin ellos (captura web) basta el proyecto.
        """
        project = self.env["project.project"].browse(int(project_id))
        if not project.exists():
            raise ValidationError("El proyecto no existe.")
        if not project.account_id:
            project._altitud_ensure_analytic_account()
        if not project.account_id:
            raise ValidationError(
                f"{project.x_folio or project.name} no tiene cuenta analítica."
            )

        try:
            importe = float(amount)
        except (TypeError, ValueError) as error:
            raise ValidationError("El importe tiene que ser un número.") from error
        if importe <= 0:
            raise ValidationError("El importe debe ser mayor a cero.")

        partida = category or "gastos_operativos"
        if partida not in PARTIDA_KEYS:
            raise ValidationError(f'La partida "{partida}" no existe.')

        employee = None
        if chat_id or employee_id:
            employee = self.env["hr.employee"]._altitud_resolver(
                employee_id=employee_id, chat_id=chat_id
            )
            crew = self.env["altitud.crew"].search_count(
                [
                    ("project_id", "=", project.id),
                    ("employee_id", "=", employee.id),
                    ("active", "=", True),
                ]
            )
            if not crew:
                raise ValidationError(
                    f"{employee.name} no está en la cuadrilla de "
                    f"{project.x_folio or project.name}."
                )

        quien = captured_by or (employee.name if employee else False)
        hay_foto = bool(photo_data)
        folio = self.env["ir.sequence"].next_by_code("altitud.field.expense") or "/"

        line = self.create(
            {
                "name": concept or "Gasto de campo",
                "date": date or fields.Date.context_today(self),
                "amount": -abs(importe),
                "unit_amount": 0,
                "account_id": project.account_id.id,
                "company_id": project.company_id.id,
                "x_project_id": project.id,
                "x_partida": partida,
                "x_source": "gasto_campo",
                "ref": folio,
                "x_registered_by": quien,
                "x_captured_by": quien,
                "x_has_receipt": True if hay_foto else bool(has_receipt),
            }
        )

        if hay_foto:
            self.env["ir.attachment"].create(
                {
                    "name": photo_name or f"{folio}.jpg",
                    "type": "binary",
                    "datas": photo_data,
                    "mimetype": photo_mimetype or "image/jpeg",
                    "res_model": "account.analytic.line",
                    "res_id": line.id,
                }
            )

        return {
            "id": line.id,
            "ref": line.ref,
            "amount": abs(line.amount),
            "project_id": project.id,
            "project_folio": project.x_folio or "",
            "has_receipt": line.x_has_receipt,
        }
