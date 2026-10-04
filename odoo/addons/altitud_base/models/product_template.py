from odoo import fields, models

from .constants import AREAS


class ProductTemplate(models.Model):
    """Servicio del catálogo con su paramétrico. [R-10] [R-12] [R-16]

    Precio y costo son los nativos (`list_price`, `standard_price`). Lo que
    Odoo no tiene es el rendimiento: cuántas unidades hace un técnico en un
    jornal, que es de donde salen los jornales de la cotización.
    """

    _inherit = "product.template"

    x_area = fields.Selection(AREAS, string="Área", index=True)
    x_yield_per_jornal = fields.Float(string="Rendimiento por jornal", default=1.0)
