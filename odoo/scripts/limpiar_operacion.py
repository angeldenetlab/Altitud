"""Borra la operación de la base y deja solo los catálogos.

Sirve para dejar la base lista para arrancar de verdad después de probar, o
para repetir una prueba desde cero. NO toca servicios, personal, insumos ni
proveedores: eso lo carga `seed_catalogos.py`.

Uso:  python3 limpiar_operacion.py
"""

from rpc import connect


def main():
    uid, call = connect()

    def ids_of(model, domain):
        return call(model, "search", domain, context={"active_test": False})

    def borrar_asistencias():
        """Borrar la asistencia se lleva su parte de horas."""
        for aid in ids_of("hr.attendance", []):
            try:
                call("hr.attendance", "unlink", [aid])
            except Exception:
                pass

    # Dos pasadas: la primera se lleva la mayoría, y la segunda a las que se
    # trababan por su línea analítica, que para entonces ya no existe.
    borrar_asistencias()

    for lid in ids_of("account.analytic.line", []):
        try:
            call("account.analytic.line", "unlink", [lid])
        except Exception:
            pass

    borrar_asistencias()
    pendientes = call("hr.attendance", "search_count", [])
    if pendientes:
        print(f"  quedaron {pendientes} asistencias sin borrar")

    # Odoo no deja tirar un pedido sin más. La compra exige estar cancelada
    # (no basta con borrador); la venta, con borrador se deja.
    for model, estado in (("purchase.order", "cancel"), ("sale.order", "draft")):
        ids = ids_of(model, [])
        if not ids:
            continue
        try:
            call(model, "write", ids, {"state": estado})
        except Exception as exc:
            print(f"  {model}: no se pudo pasar a {estado} ({str(exc)[:50]})")
        for one in ids:
            try:
                call(model, "unlink", [one])
            except Exception as exc:
                print(f"  {model} {one}: {str(exc)[:70]}")

    for model in ("altitud.extra", "altitud.budget.line", "altitud.crew", "mail.activity"):
        ids = ids_of(model, [])
        if ids:
            call(model, "unlink", ids)

    ids = ids_of("ir.attachment", [["res_model", "in", ["project.project", "sale.order"]]])
    if ids:
        call("ir.attachment", "unlink", ids)

    for tid in ids_of("project.task", []):
        try:
            call("project.task", "unlink", [tid])
        except Exception:
            pass

    for pid in ids_of("project.project", [["x_folio", "!=", False]]):
        try:
            call("project.project", "unlink", [pid])
        except Exception as exc:
            print(f"  proyecto {pid}: {str(exc)[:70]}")

    ids = ids_of("res.partner", [["x_folio", "!=", False]])
    if ids:
        try:
            call("res.partner", "unlink", ids)
        except Exception:
            call("res.partner", "write", ids, {"active": False})

    for code in (
        "altitud.project",
        "altitud.quote",
        "altitud.client",
        "altitud.purchase",
        "altitud.field.expense",
    ):
        seq = call("ir.sequence", "search", [["code", "=", code]])
        if seq:
            call("ir.sequence", "write", seq, {"number_next": 1})

    print("Queda en la base:")
    for model, label, domain in [
        ("product.template", "servicios", [["x_area", "!=", False]]),
        ("hr.employee", "personal", []),
        ("altitud.supply", "insumos", []),
        ("project.project", "proyectos", [["x_folio", "!=", False]]),
        ("sale.order", "cotizaciones", []),
        ("hr.attendance", "asistencias", []),
    ]:
        print(f"  {label}: {call(model, 'search_count', domain)}")


if __name__ == "__main__":
    main()
