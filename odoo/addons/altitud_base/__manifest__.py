{
    "name": "Altitud · Base",
    "version": "18.0.1.3.0",
    "summary": "Control de proyectos de Altitud sobre el módulo de Proyectos de Odoo",
    "description": """
Cubre los huecos entre el front de Altitud y Odoo 18:

* Folio, área y sitio en el proyecto; etapas propias del kanban.
* Presupuesto por partida (cantidad x costo unitario), extras y faltantes.
* Cuadrilla del proyecto y asistencia por jornada (completa / media / falta).
* La asistencia mantiene sola su parte de horas, que es el costo de mano de
  obra del proyecto. Una captura, un costo, sin líneas huérfanas.
* Flujo propio de la cotización (visto bueno del socio) sobre sale.order.
* Compras cargadas al proyecto con referencia del CFDI del proveedor.
* Identidad de Telegram en el colaborador; la jornada y el ticket de campo
  se capturan por el mismo modelo que el portal.
* Levantamiento (altitud.survey): oficina abre nombre y ubicación; de ahí
  sale la cotización. El proyecto no se crea en este paso.
* Los servicios de catálogo abren un proyecto vacío al confirmar la venta
  (service_tracking = project_only).
""",
    "author": "Altitud",
    "license": "LGPL-3",
    "category": "Services/Project",
    "depends": [
        "project",
        "hr",
        "hr_attendance",
        "hr_timesheet",
        "sale_management",
        "sale_project",
        "purchase",
        "analytic",
    ],
    "data": [
        "security/ir.model.access.csv",
        "data/ir_sequence.xml",
        "data/project_stage.xml",
        "data/ir_config_parameter.xml",
        "data/product_service_tracking.xml",
        "views/altitud_menus.xml",
        "views/altitud_survey.xml",
        "views/hr_employee.xml",
    ],
    "installable": True,
    "application": False,
}
