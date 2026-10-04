from odoo import fields, models

from .constants import CODIGOS_COMPANIA


class ResCompany(models.Model):
    """Las dos razones sociales con las que se opera. [R-37]"""

    _inherit = "res.company"

    x_code = fields.Selection(CODIGOS_COMPANIA, string="Clave en Altitud", index=True)
