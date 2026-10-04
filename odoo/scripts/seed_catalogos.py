"""Datos de arranque de los catálogos de Altitud.

Son los catálogos que el resto de los módulos consulta para no capturar
precios y jornales a mano: servicios con su paramétrico, personal con su
jornal, insumos de conteo y algunos proveedores. [R-10] [R-16] [R-20] [R-25]

No son datos de demostración: son el punto de partida que la operación
corrige. Si ya existe un registro con el mismo código o nombre, se actualiza
en lugar de duplicarse, así que el script se puede volver a correr.

Uso:  python3 seed_catalogos.py
"""

from rpc import connect

# (código, nombre, área, unidad, precio, costo, rendimiento por jornal)
SERVICIOS = [
    ("ALT-01", "Lavado de cristal en fachada", "altura", "m²", 38, 16, 45),
    ("ALT-02", "Pintura de fachada con andamio colgante", "altura", "m²", 95, 42, 18),
    ("ALT-03", "Impermeabilización de losa", "altura", "m²", 180, 92, 25),
    ("ALT-04", "Limpieza de canalones y bajadas", "altura", "m", 65, 28, 60),
    ("ALT-05", "Instalación de líneas de vida", "altura", "m", 520, 260, 12),
    ("LIM-01", "Limpieza fina post obra", "limpieza", "m²", 28, 12, 60),
    ("LIM-02", "Pulido y encerado de piso", "limpieza", "m²", 45, 19, 40),
    ("LIM-03", "Lavado de alfombra e inyección", "limpieza", "m²", 38, 15, 50),
    ("LIM-04", "Limpieza profunda de sanitarios", "limpieza", "Units", 380, 160, 6),
    ("LIM-05", "Sanitización de oficinas", "limpieza", "m²", 22, 9, 120),
    ("OBR-01", "Muro de tablaroca a dos caras", "obra", "m²", 420, 230, 12),
    ("OBR-02", "Aplanado y pasta", "obra", "m²", 190, 98, 22),
    ("OBR-03", "Pintura interior (dos manos)", "obra", "m²", 65, 28, 40),
    ("OBR-04", "Colocación de piso cerámico", "obra", "m²", 310, 165, 14),
    ("OBR-05", "Plafón acústico reticular", "obra", "m²", 380, 210, 16),
]

# (nombre, puesto, área, jornal, clave de compañía)
PERSONAL = [
    ("Ricardo Alcántara Vega", "Supervisor de altura", "altura", 980, "altitude"),
    ("Gabriel Ochoa Ramírez", "Técnico en altura", "altura", 720, "altitude"),
    ("Israel Bautista Cruz", "Técnico en altura", "altura", 720, "altitude"),
    ("Omar Trejo Salinas", "Técnico en altura", "altura", 680, "altitude"),
    ("Fernando Quiroz Medina", "Técnico en altura", "altura", 680, "altitude"),
    ("Alan Estrada Nieto", "Técnico en altura", "altura", 650, "altitude"),
    ("Marco Villalobos Díaz", "Técnico en altura", "altura", 650, "altitude"),
    ("Néstor Camacho Ruvalcaba", "Ayudante de altura", "altura", 520, "altitude"),
    ("Julio Pardo Escamilla", "Ayudante de altura", "altura", 520, "altitude"),
    ("Rubén Delgadillo Mora", "Andamiero", "altura", 600, "altitude"),
    ("Lorena Espinoza Farías", "Supervisora de limpieza", "limpieza", 850, "servicios"),
    ("Maribel Sánchez Tovar", "Auxiliar de limpieza fina", "limpieza", 480, "servicios"),
    ("Rosa Elena Prado Luna", "Auxiliar de limpieza fina", "limpieza", 480, "servicios"),
    ("Verónica Ibarra Cano", "Auxiliar de limpieza fina", "limpieza", 460, "servicios"),
    ("Claudia Rentería Solís", "Auxiliar de limpieza fina", "limpieza", 460, "servicios"),
    ("Erika Montaño Barajas", "Auxiliar de limpieza fina", "limpieza", 450, "servicios"),
    ("Silvia Aguilar Peña", "Auxiliar de limpieza fina", "limpieza", 450, "servicios"),
    ("Norma Chávez Zúñiga", "Auxiliar de limpieza fina", "limpieza", 450, "servicios"),
    ("Adriana Fuentes Robles", "Auxiliar de limpieza fina", "limpieza", 450, "servicios"),
    ("Jazmín Corona Téllez", "Operadora de pulidora", "limpieza", 540, "servicios"),
    ("Hugo Barrera Cortés", "Maestro de obra", "obra", 950, "servicios"),
    ("Efraín Lugo Mendoza", "Oficial albañil", "obra", 620, "servicios"),
    ("Salvador Nájera Ponce", "Oficial albañil", "obra", 620, "servicios"),
    ("Álvaro Cisneros Rubio", "Oficial tablarroquero", "obra", 640, "servicios"),
    ("Miguel Ángel Serna Ríos", "Oficial pintor", "obra", 600, "servicios"),
    ("Rogelio Pineda Cabrera", "Oficial pintor", "obra", 600, "servicios"),
    ("Daniel Zamudio Herrera", "Ayudante general", "obra", 480, "servicios"),
    ("Kevin Rosales Guerra", "Ayudante general", "obra", 480, "servicios"),
    ("Uriel Mancilla Ávila", "Ayudante general", "obra", 460, "servicios"),
    ("Josué Arreola Padilla", "Ayudante general", "mixto", 460, "servicios"),
    ("Cristian Valadez Ortiz", "Comodín / apoyo", "mixto", 500, "servicios"),
    ("Emiliano Ceja Rangel", "Comodín / apoyo", "mixto", 500, "altitude"),
]

PROVEEDORES = [
    "Ferretería y Tornillos del Valle",
    "Pinturas Comex Sucursal Américas",
    "Andamios y Equipo en Renta GDL",
    "Químicos y Limpieza Industrial SA",
    "Materiales Constructor Poniente",
    "Arnés y Seguridad Vertical MX",
    "Home Depot Zapopan",
    "Distribuidora de Tablaroca Occidente",
]

# (código, nombre, unidad, existencia, mínimo)
INSUMOS = [
    ("INS-01", "Jabón en polvo industrial 10 kg", "costal", 6, 4),
    ("INS-02", "Tíner estándar 19 L", "cubeta", 2, 3),
    ("INS-03", "Estopa blanca", "kg", 14, 10),
    ("INS-04", "Fibra verde reforzada", "pieza", 38, 24),
    ("INS-05", "Cloro 20 L", "garrafón", 3, 4),
    ("INS-06", "Bolsa negra jumbo", "paquete", 11, 8),
    ("INS-07", "Guante de nitrilo", "par", 44, 30),
    ("INS-08", "Cera para piso 19 L", "cubeta", 1, 2),
]


def main():
    uid, call = connect()
    ctx = {"allowed_company_ids": [1, 2]}

    companies = {
        c["x_code"]: c["id"]
        for c in call("res.company", "search_read", [], ["id", "x_code"])
        if c.get("x_code")
    }

    # --- Servicios -------------------------------------------------------
    uoms = {u["name"]: u["id"] for u in call("uom.uom", "search_read", [], ["id", "name"])}
    creados = actualizados = 0
    for code, name, area, unit, price, cost, rend in SERVICIOS:
        vals = {
            "name": name,
            "default_code": code,
            "type": "service",
            "sale_ok": True,
            "purchase_ok": False,
            "list_price": price,
            "standard_price": cost,
            "x_area": area,
            "x_yield_per_jornal": rend,
        }
        if unit in uoms:
            vals["uom_id"] = uoms[unit]
            vals["uom_po_id"] = uoms[unit]

        existing = call(
            "product.template", "search", [["default_code", "=", code]], context=ctx
        )
        if existing:
            call("product.template", "write", existing, vals, context=ctx)
            actualizados += 1
        else:
            call("product.template", "create", vals, context=ctx)
            creados += 1
    print(f"  servicios: {creados} nuevos, {actualizados} actualizados")

    # --- Personal --------------------------------------------------------
    creados = actualizados = 0
    for name, job, area, jornal, company in PERSONAL:
        vals = {
            "name": name,
            "job_title": job,
            "x_area": area,
            "x_jornal": jornal,
            "company_id": companies.get(company, 1),
        }
        existing = call(
            "hr.employee", "search", [["name", "=", name]], context={**ctx, "active_test": False}
        )
        if existing:
            call("hr.employee", "write", existing, vals, context=ctx)
            actualizados += 1
        else:
            call("hr.employee", "create", vals, context=ctx)
            creados += 1
    print(f"  personal: {creados} nuevos, {actualizados} actualizados")

    # --- Proveedores -----------------------------------------------------
    creados = 0
    for name in PROVEEDORES:
        existing = call("res.partner", "search", [["name", "=", name]], context=ctx)
        if existing:
            call("res.partner", "write", existing, {"supplier_rank": 1}, context=ctx)
        else:
            call(
                "res.partner",
                "create",
                {"name": name, "supplier_rank": 1, "company_type": "company"},
                context=ctx,
            )
            creados += 1
    print(f"  proveedores: {creados} nuevos")

    # --- Insumos ---------------------------------------------------------
    creados = actualizados = 0
    for code, name, unit, on_hand, reorder in INSUMOS:
        vals = {
            "code": code,
            "name": name,
            "unit": unit,
            "on_hand": on_hand,
            "reorder_point": reorder,
        }
        existing = call("altitud.supply", "search", [["code", "=", code]], context=ctx)
        if existing:
            call("altitud.supply", "write", existing, vals, context=ctx)
            actualizados += 1
        else:
            call("altitud.supply", "create", vals, context=ctx)
            creados += 1
    print(f"  insumos: {creados} nuevos, {actualizados} actualizados")

    print("Listo.")


if __name__ == "__main__":
    main()
