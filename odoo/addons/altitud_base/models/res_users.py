from odoo import fields, models

from .constants import ROLES_APP


class ResUsers(models.Model):
    """El rol con el que se entra al front. [R-33]

    La matriz de permisos vive en el front (`src/lib/auth/rbac.ts`) y la
    reexige el BFF. Aquí solo se guarda qué perfil le toca a cada usuario.
    """

    _inherit = "res.users"

    x_app_role = fields.Selection(
        ROLES_APP, string="Rol en Altitud", default="control"
    )

    @property
    def SELF_READABLE_FIELDS(self):
        return super().SELF_READABLE_FIELDS + ["x_app_role"]
