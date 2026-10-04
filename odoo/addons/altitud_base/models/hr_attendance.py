from datetime import timedelta

from odoo import api, fields, models
from odoo.exceptions import ValidationError

from .constants import (
    FACTOR_JORNADA,
    HORAS_JORNADA_DEFECTO,
    JORNADAS,
    PARAM_HORAS_JORNADA,
)


class HrAttendance(models.Model):
    """Asistencia del día, siempre contra un proyecto. [R-17] [R-19]

    La pantalla captura una jornada, no un reloj: el reloj se arma aquí para
    que el registro nativo sea válido.

    El costo de mano de obra no se captura dos veces. Esta misma asistencia
    mantiene su parte de horas (`account.analytic.line`), que es el gasto real
    del proyecto. Crear, cambiar el tipo, reasignar o borrar la asistencia
    mueve esa línea con ella, se haga desde el front o desde Odoo.
    """

    _inherit = "hr.attendance"

    x_project_id = fields.Many2one(
        "project.project", string="Proyecto", index=True, ondelete="restrict"
    )
    x_jornada = fields.Selection(JORNADAS, string="Jornada", index=True)
    x_source = fields.Selection(
        [
            ("web", "Captura web"),
            ("supervisor", "Supervisor"),
            ("portal", "Portal de campo"),
        ],
        string="Origen",
        default="web",
    )
    x_note = fields.Char(string="Nota")
    x_registered_by = fields.Char(string="Registró")
    x_timesheet_id = fields.Many2one(
        "account.analytic.line",
        string="Costo en el proyecto",
        ondelete="set null",
        copy=False,
        readonly=True,
    )

    # ------------------------------------------------------------------
    # Parámetros
    # ------------------------------------------------------------------
    @api.model
    def _altitud_horas_jornada(self):
        value = self.env["ir.config_parameter"].sudo().get_param(PARAM_HORAS_JORNADA)
        try:
            return float(value) if value else HORAS_JORNADA_DEFECTO
        except (TypeError, ValueError):
            return HORAS_JORNADA_DEFECTO

    @api.model
    def altitud_clock(self, day, jornada):
        """Reloj de la jornada, anclado a las 08:00 locales.

        Una falta son cero horas: `check_in == check_out`. Se queda como
        registro para que cambiar el tipo sea el mismo renglón y para que el
        tablero y la prenómina la cuenten.
        """
        horas = self._altitud_horas_jornada() * FACTOR_JORNADA.get(jornada, 0.0)
        inicio = fields.Datetime.to_datetime(f"{day} 08:00:00")
        # 08:00 locales. El usuario trabaja en su huso; Odoo guarda en UTC.
        offset = self._altitud_utc_offset(inicio)
        inicio = inicio - offset
        return inicio, inicio + timedelta(hours=horas)

    @api.model
    def _altitud_utc_offset(self, naive_dt):
        import pytz

        tz_name = self.env.user.tz or "America/Mexico_City"
        tz = pytz.timezone(tz_name)
        return tz.localize(naive_dt).utcoffset()

    # ------------------------------------------------------------------
    # Reglas del negocio
    # ------------------------------------------------------------------
    @api.constrains("x_project_id", "employee_id", "x_jornada")
    def _check_altitud_crew(self):
        """Sin cuadrilla no hay asistencia."""
        for att in self:
            if not att.x_project_id or not att.x_jornada:
                continue
            crew = self.env["altitud.crew"].search_count(
                [
                    ("project_id", "=", att.x_project_id.id),
                    ("employee_id", "=", att.employee_id.id),
                    ("active", "=", True),
                ]
            )
            if not crew:
                raise ValidationError(
                    f"{att.employee_id.name} no está en la cuadrilla de "
                    f"{att.x_project_id.x_folio or att.x_project_id.name}."
                )

    @api.constrains("check_in", "employee_id", "x_jornada")
    def _check_altitud_una_por_dia(self):
        """Una persona, un registro de jornada al día.

        El nativo permite varias entradas y salidas; aquí la unidad es la
        jornada, aunque la persona esté en varias cuadrillas.
        """
        for att in self:
            if not att.x_jornada or not att.check_in:
                continue
            day = fields.Datetime.context_timestamp(att, att.check_in).date()
            # El rango se calcula en UTC, que es como Odoo guarda `check_in`.
            # Comparar contra "<día> 00:00:00" local dejaría escapar cualquier
            # registro capturado a mano fuera de la ventana de la jornada.
            desde, hasta = self._altitud_utc_bounds(day)
            same_day = self.search(
                [
                    ("id", "!=", att.id),
                    ("employee_id", "=", att.employee_id.id),
                    ("x_jornada", "!=", False),
                    ("check_in", ">=", desde),
                    ("check_in", "<=", hasta),
                ],
                limit=1,
            )
            if same_day:
                raise ValidationError(
                    f"{att.employee_id.name} ya tiene jornada registrada el {day}."
                )

    @api.model
    def _altitud_utc_bounds(self, day):
        """Principio y fin de un día local, expresados en UTC."""
        from datetime import datetime, time

        inicio = datetime.combine(day, time.min)
        fin = datetime.combine(day, time.max)
        return inicio - self._altitud_utc_offset(inicio), fin - self._altitud_utc_offset(fin)

    # ------------------------------------------------------------------
    # Puente con el costo del proyecto
    # ------------------------------------------------------------------
    def _altitud_sync_timesheet(self):
        """Deja una sola parte de horas por asistencia, o ninguna si es falta."""
        horas_jornada = self._altitud_horas_jornada()
        for att in self:
            factor = FACTOR_JORNADA.get(att.x_jornada or "", 0.0)
            quiere_linea = bool(att.x_project_id) and factor > 0

            linea = att.x_timesheet_id.exists()
            if not quiere_linea:
                if linea:
                    linea.sudo().unlink()
                if att.x_timesheet_id:
                    att.x_timesheet_id = False
                continue

            day = fields.Datetime.context_timestamp(att, att.check_in).date()
            vals = {
                "name": f"Asistencia {att.employee_id.name}",
                "project_id": att.x_project_id.id,
                "employee_id": att.employee_id.id,
                "date": day,
                "unit_amount": horas_jornada * factor,
                "ref": f"AS-{att.id}",
                "x_partida": "mano_obra",
                "x_source": "asistencia",
                "x_attendance_id": att.id,
                "x_project_id": att.x_project_id.id,
                "x_registered_by": att.x_registered_by or "Cálculo automático",
            }
            if linea:
                linea.sudo().write(vals)
            else:
                line = self.env["account.analytic.line"].sudo().create(vals)
                att.x_timesheet_id = line.id

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            jornada = vals.get("x_jornada")
            if jornada and not vals.get("check_in"):
                day = vals.pop("x_day", None) or fields.Date.context_today(self)
                check_in, check_out = self.altitud_clock(day, jornada)
                vals["check_in"] = check_in
                vals["check_out"] = check_out
        records = super().create(vals_list)
        records._altitud_sync_timesheet()
        return records

    def write(self, vals):
        jornada = vals.get("x_jornada")
        if jornada and "check_in" not in vals:
            # Cambiar el tipo de jornada mueve el reloj y el costo.
            for att in self:
                day = fields.Datetime.context_timestamp(att, att.check_in).date()
                check_in, check_out = self.altitud_clock(day, jornada)
                super(HrAttendance, att).write(
                    dict(vals, check_in=check_in, check_out=check_out)
                )
            self._altitud_sync_timesheet()
            return True

        result = super().write(vals)
        if {"x_jornada", "x_project_id", "employee_id", "check_in"} & set(vals):
            self._altitud_sync_timesheet()
        return result

    def unlink(self):
        """Borrar la asistencia borra su costo. No queda gasto huérfano.

        `exists()` no sobra: si alguien ya borró la parte de horas a mano desde
        Odoo, borrar la asistencia no se puede caer por eso.
        """
        lines = self.mapped("x_timesheet_id").exists()
        result = super().unlink()
        if lines:
            lines.sudo().unlink()
        return result

    # El kiosco nativo cuenta "quién está adentro" por check_out vacío; una
    # falta tiene check_out, así que no aparece como presente.
