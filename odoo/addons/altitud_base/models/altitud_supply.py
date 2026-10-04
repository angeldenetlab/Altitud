from odoo import fields, models


class AltitudSupply(models.Model):
    """Conteo básico de insumos: solo para saber cuándo reponer. [R-25]

    No es inventario: no hay entradas, salidas ni almacenes. Por eso no se
    apoya en `stock`.
    """

    _name = "altitud.supply"
    _description = "Insumo en conteo"
    _order = "code"

    code = fields.Char(string="Código", required=True)
    name = fields.Char(string="Insumo", required=True)
    unit = fields.Char(string="Unidad", default="pieza")
    on_hand = fields.Float(string="Existencia")
    reorder_point = fields.Float(string="Mínimo para reponer")
    last_count = fields.Date(string="Último conteo")
    active = fields.Boolean(default=True)

    _sql_constraints = [("code_uniq", "unique(code)", "Ya existe un insumo con ese código.")]
