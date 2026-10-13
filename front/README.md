# Altitud · Portal de levantamientos

Front de campo para el **empleado asignado**. Se usa en celular o tableta, en
el sitio: ahí se asigna el levantamiento, se captura y se cierra.

No es el sistema de oficina. Oficina trabaja en **Odoo 18 nativo**: ahí abre el
levantamiento (`altitud.survey`, menú Altitud) con nombre, ubicación y empleado,
y de ahí genera la cotización. Este portal solo llena la captura de sitio.

El BFF de Next que vivía en esta carpeta **ya no existe**. No hay `/api/erp/*`,
ni panel, ni roles de aplicación: el portal habla con Odoo por JSON-RPC desde
Server Actions.

## Las tres pantallas

| Ruta | Qué hace |
|---|---|
| `/login` | Entra con el usuario y la contraseña de Odoo |
| `/levantamientos` | **Míos** (los que le tocan) y **Todos los abiertos** (para asignarse uno) |
| `/levantamientos/[id]` | Captura el sitio, sube fotos y cierra |

El empleado no da de alta levantamientos ni toca cliente, área o razón social:
eso es de oficina. Cerrar pone el levantamiento en **Listo**, que es lo que
oficina espera para cotizar.

## Qué escribe en Odoo

Todo cae en el mismo registro `altitud.survey`:

| Campo | Cuándo |
|---|---|
| `employee_id` | Al asignarse («Asignármelo») |
| `description`, `floor_count`, `measurements`, `site_conditions` | Se guardan solos mientras captura |
| `photo_ids` | Al subir cada foto (`ir.attachment` ligado al levantamiento) |
| `state` = `listo`, `survey_date`, `surveyed_by_id` | Al cerrar |

`measurements` se guarda como JSON `[{label, value, unit}]`, que es el formato
que ya lee la ficha de Odoo. Un texto viejo que no sea JSON no se pierde: entra
como la primera medida.

Para cerrar hacen falta descripción, número de plantas, al menos una medida y
condiciones del sitio. Las fotos no bloquean, pero son la evidencia del sitio.

Un levantamiento cerrado se puede **reabrir** mientras no tenga cotización. Con
cotización generada, la corrección es de oficina.

## Cómo está armado

```
Pantalla (servidor)
    →  src/server/surveys.ts      lecturas y escrituras del levantamiento
        →  src/lib/odoo/client.ts  JSON-RPC con la cuenta técnica
Acción del empleado (cliente)
    →  Server Action en src/app/**/actions.ts  (vuelve a exigir sesión y dueño)
```

| Pieza | Dónde |
|---|---|
| Pantallas | `src/app/login/`, `src/app/levantamientos/` |
| Acciones (asignar, guardar, cerrar, fotos) | `src/app/levantamientos/actions.ts` |
| Entrada y salida | `src/app/login/actions.ts` |
| Datos del levantamiento | `src/server/surveys.ts` |
| Cliente de Odoo | `src/lib/odoo/` |
| Sesión (cookie firmada) | `src/lib/auth/session.ts` |
| Corte de rutas | `src/proxy.ts` |
| Fotos servidas al teléfono | `src/app/api/fotos/[id]/route.ts` |

### Las dos identidades

| Quién | Cuándo | Credencial |
|---|---|---|
| El empleado que entra | **Solo en el login** | Su contraseña de Odoo. No se guarda |
| La cuenta técnica | Todas las lecturas y escrituras | `ODOO_USER` + `ODOO_API_KEY` |

Como Odoo ve todas las escrituras con la cuenta técnica, quién levantó se
guarda del lado de Altitud: `surveyed_by_id` es el colaborador de la sesión.

### Pensado para el sitio, no para el escritorio

- La captura **se guarda sola** mientras escribe; el pie dice si ya subió.
- Si se cae la señal, lo capturado se queda en el teléfono y se reintenta al
  volver (`localStorage`), con aviso al recuperarlo.
- Las fotos se reducen a 1600 px **en el teléfono** antes de subir, respetando
  la orientación del EXIF. Suben de una en una para reintentar solo la que falle.
- Botones de 48 px y texto de 16 px en los campos: abajo de eso iOS hace zoom
  al enfocar.

## Quién puede entrar

Un usuario interno de Odoo (`share = false`) **con colaborador ligado**
(`hr.employee.user_id`). Sin colaborador no hay portal: la bandeja se arma con
`employee_id`, no con el usuario.

Hoy casi ningún colaborador tiene usuario. Para ver quién puede entrar y dar
acceso:

```bash
cd ../odoo/scripts
python3 accesos_portal.py                      # lista colaboradores y accesos
python3 accesos_portal.py --empleado "Alan Estrada Nieto" \
    --login alan@altitud.mx                    # crea el usuario y lo liga
```

## Levantar

Necesitas el Odoo de `../odoo` corriendo (`docker compose up -d`) con la base
`altitud`.

```bash
cp .env.example .env.local   # AUTH_SECRET y la conexión a Odoo
npm install
npm run dev                  # http://localhost:3001
```

Para probarlo desde el celular en la misma red: `npm run dev:vps` y agrega la
dirección del equipo a `ALLOWED_DEV_ORIGINS`.

En producción, `COOKIE_SECURE=true` detrás de HTTPS. El contenedor está en
`Dockerfile` y `docker-compose.yml` (puerto 3001).

## Fuera de alcance

- Dar de alta levantamientos. Los abre oficina en Odoo.
- Cotizar. La cotización sale del levantamiento, en Odoo, con **Generar
  cotización**.
- Proyectos, compras, asistencias y prenómina: Odoo nativo.
