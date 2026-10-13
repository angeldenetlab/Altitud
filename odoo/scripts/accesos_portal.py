"""Accesos al portal de levantamientos.

El portal se ordena por colaborador (`hr.employee`), no por usuario: para
entrar, el empleado necesita un usuario de Odoo ligado en `user_id`. Hoy casi
ningún colaborador lo tiene, así que este script lo resuelve sin abrir Odoo.

Uso:

    python3 accesos_portal.py
        Lista los colaboradores y si ya pueden entrar.

    python3 accesos_portal.py --empleado "Alan Estrada Nieto" \
        --login alan@altitud.mx [--password Temporal.2026]
        Crea el usuario interno (rol `campo`), lo liga al colaborador y
        enseña la contraseña temporal. Si el usuario ya existe, solo lo liga.

Idempotente: se puede correr las veces que haga falta.
"""

import argparse
import secrets
import sys

from rpc import connect


def listar(call):
    employees = call(
        "hr.employee",
        "search_read",
        [["active", "=", True]],
        ["id", "name", "user_id", "x_area"],
        order="name",
    )
    con, sin = [], []
    for employee in employees:
        (con if employee["user_id"] else sin).append(employee)

    print(f"\nPueden entrar al portal ({len(con)}):")
    for employee in con:
        print(f"  {employee['name']:<32} {employee['user_id'][1]}")

    print(f"\nSin usuario ligado ({len(sin)}):")
    for employee in sin:
        print(f"  {employee['name']:<32} área: {employee['x_area'] or '—'}")
    print("\nPara dar acceso:  python3 accesos_portal.py --empleado \"Nombre\" --login correo")


def dar_acceso(call, nombre, login, password):
    employees = call("hr.employee", "search_read", [["name", "=", nombre]], ["id", "name", "user_id"])
    if not employees:
        sys.exit(f"No hay colaborador llamado «{nombre}». Córrelo sin argumentos para ver la lista.")
    if len(employees) > 1:
        sys.exit(f"Hay {len(employees)} colaboradores con ese nombre. Desambigua en Odoo.")
    employee = employees[0]

    if employee["user_id"]:
        print(f"  {employee['name']} ya entra con {employee['user_id'][1]}.")
        return

    existing = call("res.users", "search_read", [["login", "=", login]], ["id", "name", "share"])
    if existing:
        user_id = existing[0]["id"]
        if existing[0]["share"]:
            sys.exit(f"El usuario {login} es de portal (share). El portal es para gente de adentro.")
        print(f"  El usuario {login} ya existía: se liga al colaborador.")
    else:
        group_id = call("ir.model.data", "check_object_reference", "base", "group_user")[1]
        user_id = call(
            "res.users",
            "create",
            {
                "name": employee["name"],
                "login": login,
                "password": password,
                "groups_id": [(4, group_id)],
                "x_app_role": "campo",
            },
        )
        print(f"  Usuario creado: {login} · contraseña temporal: {password}")

    call("hr.employee", "write", [employee["id"]], {"user_id": user_id})
    print(f"  {employee['name']} ya puede entrar al portal de levantamientos.")


def main():
    parser = argparse.ArgumentParser(description="Accesos al portal de levantamientos.")
    parser.add_argument("--empleado", help="Nombre exacto del colaborador en Odoo.")
    parser.add_argument("--login", help="Usuario de Odoo (normalmente su correo).")
    parser.add_argument("--password", help="Contraseña temporal. Si no va, se genera una.")
    args = parser.parse_args()

    _, call = connect()

    if not args.empleado:
        listar(call)
        return

    if not args.login:
        sys.exit("Falta --login: el usuario con el que va a entrar.")
    dar_acceso(call, args.empleado, args.login, args.password or secrets.token_urlsafe(9))


if __name__ == "__main__":
    main()
