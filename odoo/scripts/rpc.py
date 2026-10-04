"""Cliente XML-RPC mínimo para los scripts de configuración de Altitud.

Usa las mismas variables que el BFF (`front/.env.local`), para que scripts y
aplicación entren con la misma cuenta técnica:

    ODOO_URL        http://127.0.0.1:8072
    ODOO_DB         altitud
    ODOO_USER       la cuenta técnica
    ODOO_API_KEY    llave de API (tiene prioridad)
    ODOO_PASSWORD   contraseña, solo si no hay llave

Si no encuentra las variables en el entorno, las lee de `front/.env.local`.
"""

import os
import sys
import xmlrpc.client
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parents[2] / "front" / ".env.local"


def _from_env_file(key):
    """Lee una variable de `front/.env.local` sin dependencias externas."""
    if not ENV_FILE.exists():
        return None
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        if name.strip() == key:
            return value.strip().strip("\"'") or None
    return None


def _setting(key, default=None):
    return os.environ.get(key) or _from_env_file(key) or default


URL = _setting("ODOO_URL", "http://127.0.0.1:8072")
DB = _setting("ODOO_DB", "altitud")
USER = _setting("ODOO_USER", "angel@netlab.mx")
PWD = _setting("ODOO_API_KEY") or _setting("ODOO_PASSWORD", "admin")


def connect():
    common = xmlrpc.client.ServerProxy(f"{URL}/xmlrpc/2/common", allow_none=True)
    uid = common.authenticate(DB, USER, PWD, {})
    if not uid:
        print(
            f"No se pudo autenticar {USER} en {DB} ({URL}).\n"
            "Revisa ODOO_USER y ODOO_API_KEY en front/.env.local.",
            file=sys.stderr,
        )
        sys.exit(1)
    models = xmlrpc.client.ServerProxy(f"{URL}/xmlrpc/2/object", allow_none=True)

    def call(model, method, *args, **kw):
        return models.execute_kw(DB, uid, PWD, model, method, list(args), kw)

    return uid, call
