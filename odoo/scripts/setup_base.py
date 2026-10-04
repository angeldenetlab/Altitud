"""Configuración inicial de la base `altitud`.

Idempotente: se puede correr las veces que haga falta.

  1. Activa etapas de proyecto y partes de horas.
  2. Deja las dos razones sociales con su clave (`x_code`).
  3. Pone el rol de la app en los usuarios internos.
  4. Fija las horas por jornada.

Uso:  python3 setup_base.py
"""

from rpc import connect

COMPANIES = [
    ("altitude", "Altitude Servicios SA de CV", "ASE180412H21"),
    ("servicios", "Grupo Operativo ALT SA de CV", "GOA210715K33"),
]


def main():
    uid, call = connect()

    # --- 1. Grupos de funcionalidad --------------------------------------
    # `stage_id` del proyecto solo es visible con las etapas activadas.
    group_ids = []
    for xmlid in ("project.group_project_stages", "analytic.group_analytic_accounting"):
        try:
            gid = call("ir.model.data", "check_object_reference", *xmlid.split("."))[1]
            group_ids.append(gid)
        except Exception as exc:  # pragma: no cover - depende de la versión
            print(f"  aviso: no se encontró {xmlid} ({exc})")

    internal = call("res.users", "search", [["share", "=", False]])
    if group_ids:
        call("res.users", "write", internal, {"groups_id": [(4, gid) for gid in group_ids]})
        print(f"  grupos activados para {len(internal)} usuarios internos")

    # --- 2. Razones sociales ---------------------------------------------
    existing = call("res.company", "search_read", [], ["id", "name", "x_code"])
    by_code = {c["x_code"]: c for c in existing if c.get("x_code")}
    company_ids = []

    for index, (code, name, rfc) in enumerate(COMPANIES):
        if code in by_code:
            company_id = by_code[code]["id"]
            call("res.company", "write", [company_id], {"name": name, "vat": rfc})
        elif index == 0 and existing:
            # La compañía que trae la base se reutiliza como la principal.
            company_id = existing[0]["id"]
            call("res.company", "write", [company_id], {"name": name, "vat": rfc, "x_code": code})
        else:
            company_id = call("res.company", "create", {"name": name, "vat": rfc, "x_code": code})
        company_ids.append(company_id)
        print(f"  compañía {code}: id {company_id} · {name}")

    # El usuario técnico del BFF tiene que ver las dos.
    call(
        "res.users",
        "write",
        internal,
        {"company_ids": [(6, 0, company_ids)]},
    )

    # --- 3. Rol en la app -------------------------------------------------
    admins = call("res.users", "search", [["login", "=", "angel@netlab.mx"]])
    if admins:
        call("res.users", "write", admins, {"x_app_role": "socio"})
        print("  angel@netlab.mx → socio")

    sin_rol = call("res.users", "search", [["share", "=", False], ["x_app_role", "=", False]])
    if sin_rol:
        call("res.users", "write", sin_rol, {"x_app_role": "control"})

    # --- 4. Parámetros ----------------------------------------------------
    call("ir.config_parameter", "set_param", "altitud.horas_por_jornada", "8")
    print("  horas por jornada: 8")

    # --- 5. Partes de horas en las compañías ------------------------------
    for company_id in company_ids:
        uom = call(
            "res.company", "read", [company_id], ["project_time_mode_id"]
        )[0]["project_time_mode_id"]
        print(f"  compañía {company_id} · unidad de tiempo: {uom and uom[1]}")

    print("Listo.")


if __name__ == "__main__":
    main()
