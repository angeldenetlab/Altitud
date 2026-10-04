"""Catálogos fijos compartidos por los modelos de Altitud.

El orden y las claves son los mismos que usa el front
(`front/src/types/altitude.ts`), para que el BFF no tenga que traducir.
"""

AREAS = [
    ("altura", "Trabajos de altura"),
    ("limpieza", "Limpieza fina"),
    ("obra", "Obra y acabados"),
]

AREAS_CON_MIXTO = AREAS + [("mixto", "Mixto")]

#: Partidas con las que se costea. Misma estructura para las tres áreas.
PARTIDAS = [
    ("mano_obra", "Mano de obra"),
    ("materiales", "Materiales"),
    ("herramienta", "Herramienta y equipo"),
    ("gastos_operativos", "Gastos operativos"),
    ("indirectos", "Indirectos"),
]

#: De dónde salió un gasto real. Alimenta la trazabilidad sin doble captura.
FUENTES_GASTO = [
    ("compra", "Compra"),
    ("asistencia", "Asistencia"),
    ("gasto_campo", "Gasto de campo"),
    ("manual", "Captura manual"),
    ("faltante", "Faltante"),
]

JORNADAS = [
    ("completa", "Jornada completa"),
    ("media", "Media jornada"),
    ("falta", "Falta"),
]

#: Factor del jornal por tipo de jornada. [R-20]
FACTOR_JORNADA = {"completa": 1.0, "media": 0.5, "falta": 0.0}

ETAPAS_PROYECTO = [
    ("levantamiento", "Levantamiento"),
    ("cotizado", "Cotizado"),
    ("autorizado", "Autorizado"),
    ("ejecucion", "En ejecución"),
    ("por_cerrar", "Por cerrar"),
    ("cerrado", "Cerrado"),
    ("perdido", "Perdido"),
]

ESTATUS_COTIZACION = [
    ("levantamiento", "Levantamiento"),
    ("calculo", "En cálculo"),
    ("vobo_socio", "Visto bueno del socio"),
    ("enviada", "Enviada al cliente"),
    ("autorizada", "Autorizada"),
    ("no_autorizada", "No autorizada"),
]

ORIGEN_COTIZACION = [
    ("extras", "Extras de obra"),
    ("adicional", "Trabajo adicional"),
    ("inicial", "Cotización inicial"),
]

ESTATUS_PAGO = [
    ("sin_factura", "Sin factura"),
    ("por_pagar", "Por pagar"),
    ("pagada", "Pagada"),
]

ROLES_APP = [
    ("socio", "Socio / Dirección"),
    ("control", "Control de proyectos"),
    ("admin", "Administración"),
    ("tesoreria", "Tesorería"),
    ("campo", "Supervisor de campo"),
]

CODIGOS_COMPANIA = [
    ("altitude", "Altitude"),
    ("servicios", "Grupo ALT"),
]

#: Horas que dura una jornada completa. Parametrizable en ajustes.
PARAM_HORAS_JORNADA = "altitud.horas_por_jornada"
HORAS_JORNADA_DEFECTO = 8.0
