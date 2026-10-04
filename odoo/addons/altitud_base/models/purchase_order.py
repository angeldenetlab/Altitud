from odoo import fields, models

from .constants import ESTATUS_PAGO, PARTIDAS


class PurchaseOrder(models.Model):
    """Compra cargada directo a un proyecto. [R-23] [R-24]

    El pago y el XML del proveedor siguen en CONTPAQi: aquí se guarda el folio
    y el UUID para poder conciliar, y el estatus de pago es propio porque la
    contabilidad no vive en este Odoo. [R-35]
    """

    _inherit = "purchase.order"

    x_folio = fields.Char(string="Folio", index=True, copy=False, readonly=True)
    x_project_id = fields.Many2one("project.project", string="Proyecto", index=True)
    x_partida = fields.Selection(PARTIDAS, string="Partida", default="materiales")
    x_concept = fields.Char(string="Concepto")
    x_invoice_folio = fields.Char(string="Folio de factura")
    x_invoice_uuid = fields.Char(string="UUID del CFDI")
    x_pago_status = fields.Selection(
        ESTATUS_PAGO, string="Estatus de pago", default="sin_factura", index=True
    )
    x_requested_by = fields.Char(string="Solicitó")

    _sql_constraints = [("folio_uniq", "unique(x_folio)", "Ese folio de compra ya existe.")]
