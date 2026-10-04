from odoo import fields, models

from .constants import AREAS, ESTATUS_COTIZACION, ORIGEN_COTIZACION


class SaleOrder(models.Model):
    """Cotización y, una vez confirmada, orden de venta. [R-09] … [R-16]

    El flujo interno de Altitud (levantamiento → cálculo → visto bueno del
    socio → enviada → autorizada) no existe en Odoo: el pedido solo sabe de
    borrador / enviado / confirmado. Por eso el estatus del negocio vive en
    `x_status` y el `state` nativo se mueve al autorizar.
    """

    _inherit = "sale.order"

    x_folio = fields.Char(string="Folio", index=True, copy=False, readonly=True)
    #: `name` guarda el folio, que es la referencia del pedido en Odoo. El
    #: nombre del trabajo («Lavado de fachada, Torre Insurgentes») va aparte.
    x_title = fields.Char(string="Nombre del trabajo")
    x_status = fields.Selection(
        ESTATUS_COTIZACION,
        string="Estatus Altitud",
        default="levantamiento",
        index=True,
        tracking=True,
    )
    x_area = fields.Selection(AREAS, string="Área", default="limpieza", index=True)
    x_origin = fields.Selection(ORIGEN_COTIZACION, string="Origen")
    x_overhead_pct = fields.Float(string="Overhead (%)", default=22.0)
    x_cost_total = fields.Float(string="Costo directo + overhead")
    x_jornales_total = fields.Float(string="Jornales estimados")
    x_vobo_socio = fields.Boolean(string="Visto bueno del socio", tracking=True)
    x_owner = fields.Char(string="Responsable")
    x_notes = fields.Text(string="Notas")

    # --- Levantamiento en sitio: lo puede hacer quien no es socio. [R-11]
    x_survey_done_by = fields.Char(string="Levantamiento por")
    x_survey_date = fields.Date(string="Fecha del levantamiento")
    x_survey_notes = fields.Text(string="Notas del levantamiento")
    x_survey_measurements = fields.Text(
        string="Medidas", help="JSON: [{label, value, unit}]"
    )
    x_approvals = fields.Text(string="Bitácora de autorización", help="JSON")

    _sql_constraints = [("folio_uniq", "unique(x_folio)", "Ese folio de cotización ya existe.")]

    def _altitud_assign_folio(self):
        for order in self:
            if not order.x_folio:
                order.x_folio = self.env["ir.sequence"].next_by_code("altitud.quote") or "/"


class SaleOrderLine(models.Model):
    """Partida cotizada.

    `price_unit` y `product_uom_qty` son los nativos. El costo unitario y los
    jornales son de Altitud: el margen se calcula contra el costo directo y el
    rendimiento del servicio.
    """

    _inherit = "sale.order.line"

    x_cost_unit = fields.Float(string="Costo unitario")
    x_jornales = fields.Float(string="Jornales")
