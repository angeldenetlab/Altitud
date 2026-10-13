import logging

from odoo import api, fields, models

from .constants import AREAS

_logger = logging.getLogger(__name__)

#: Servicios de catálogo que abren un proyecto vacío al confirmar la venta.
#: ALT-COMPRA (compra), la hoja de horas y los productos de prueba no entran.
SERVICE_CODES_PROJECT_ONLY = (
    "ALT-01",
    "ALT-02",
    "ALT-03",
    "ALT-04",
    "ALT-05",
    "LIM-01",
    "LIM-02",
    "LIM-03",
    "LIM-04",
    "LIM-05",
    "OBR-01",
    "OBR-02",
    "OBR-03",
    "OBR-04",
    "OBR-05",
    "ALT-PARTIDA",
)


class ProductTemplate(models.Model):
    """Servicio del catálogo con su paramétrico. [R-10] [R-12] [R-16]

    Precio y costo son los nativos (`list_price`, `standard_price`). Lo que
    Odoo no tiene es el rendimiento: cuántas unidades hace un técnico en un
    jornal, que es de donde salen los jornales de la cotización.
    """

    _inherit = "product.template"

    x_area = fields.Selection(AREAS, string="Área", index=True)
    x_yield_per_jornal = fields.Float(string="Rendimiento por jornal", default=1.0)

    @api.model
    def altitud_apply_project_only_tracking(self):
        """Pasa a project_only los servicios de catálogo que siguen en Nada.

        Idempotente: si alguien ya cambió el seguimiento, no lo pisa.
        """
        products = self.with_context(active_test=False).search(
            [
                ("default_code", "in", list(SERVICE_CODES_PROJECT_ONLY)),
                ("type", "=", "service"),
                ("service_tracking", "=", "no"),
            ]
        )
        if products:
            products.write({"service_tracking": "project_only"})
        _logger.info(
            "Altitud: servicios en project_only %s",
            ", ".join(products.mapped("default_code")) or "(ninguno pendiente)",
        )
        return True
