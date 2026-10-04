from odoo import api, fields, models

from .constants import AREAS


class ProjectProjectStage(models.Model):
    """Etapa del kanban. `x_code` es la clave que entiende el front."""

    _inherit = "project.project.stage"

    x_code = fields.Char(string="Clave", index=True)


class ProjectProject(models.Model):
    """Directorio único con folio para todo trabajo. [R-01] [R-02] [R-08]"""

    _inherit = "project.project"

    #: La etapa es el gesto del kanban y lo que se delega: se trackea para que
    #: la bitácora pueda enseñar quién la movió y cuándo.
    stage_id = fields.Many2one(string="Etapa", tracking=True)

    x_folio = fields.Char(string="Folio", index=True, copy=False, readonly=True)
    x_area = fields.Selection(AREAS, string="Área", default="limpieza", index=True)
    x_sitio = fields.Char(string="Sitio")
    # Lo que se trackea es lo que la bitácora del front enseña como historial.
    x_contract_amount = fields.Float(
        string="Precio de venta autorizado",
        tracking=True,
        help="Se fija al autorizar la cotización. [R-15]",
    )
    x_coordinator_id = fields.Many2one("res.users", string="Control de proyectos")
    x_quote_folio = fields.Char(string="Cotización de origen")
    x_notes = fields.Text(string="Notas")

    # --- Cierre: el CFDI se queda en CONTPAQi, aquí solo la referencia. [R-35]
    x_invoiced_amount = fields.Float(string="Monto facturado", tracking=True)
    x_invoice_refs = fields.Char(string="Folios de factura")
    x_closed_at = fields.Date(string="Fecha de cierre")
    x_closed_by = fields.Char(string="Cerró")
    x_closure_notes = fields.Text(string="Notas del cierre")

    x_crew_ids = fields.One2many("altitud.crew", "project_id", string="Cuadrilla")
    x_budget_ids = fields.One2many("altitud.budget.line", "project_id", string="Presupuesto")
    x_extra_ids = fields.One2many("altitud.extra", "project_id", string="Extras y faltantes")

    _sql_constraints = [("folio_uniq", "unique(x_folio)", "Ese folio de proyecto ya existe.")]

    @api.model_create_multi
    def create(self, vals_list):
        """Todo trabajo lleva folio, por chico que sea. [R-01]"""
        for vals in vals_list:
            if not vals.get("x_folio"):
                vals["x_folio"] = self.env["ir.sequence"].next_by_code("altitud.project") or "/"
            # La analítica es donde se junta el costo del proyecto.
            vals.setdefault("allow_timesheets", True)
        projects = super().create(vals_list)
        projects._altitud_ensure_analytic_account()
        return projects

    def _altitud_ensure_analytic_account(self):
        """Sin cuenta analítica el proyecto no puede acumular costo."""
        plan = self.env["account.analytic.plan"].search([("parent_id", "=", False)], limit=1)
        for project in self:
            if project.account_id or not plan:
                continue
            project.account_id = self.env["account.analytic.account"].create(
                {
                    "name": project.name,
                    "code": project.x_folio,
                    "plan_id": plan.id,
                    "partner_id": project.partner_id.id,
                    "company_id": project.company_id.id,
                }
            )

    def altitud_stage_code(self):
        self.ensure_one()
        return self.stage_id.x_code or "levantamiento"
