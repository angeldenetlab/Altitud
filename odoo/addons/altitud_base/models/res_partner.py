from odoo import api, fields, models


class ResPartner(models.Model):
    """Cliente / prospecto con folio propio. [R-38]"""

    _inherit = "res.partner"

    x_folio = fields.Char(string="Folio", index=True, copy=False)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("customer_rank") and not vals.get("x_folio"):
                vals["x_folio"] = self.env["ir.sequence"].next_by_code("altitud.client") or "/"
        return super().create(vals_list)
