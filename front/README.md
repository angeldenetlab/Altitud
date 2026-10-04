# Altitude · Control de proyectos

Control de proyectos para una empresa de servicios con tres áreas operativas
(**trabajos de altura**, **limpieza fina**, **obra y acabados**), personal
operativo y dos razones sociales.

El problema que ataca: cada proceso vivía en un archivo distinto y no existía
cierre de proyecto, así que no se sabía si un trabajo ganó o perdió dinero.

El front es un **BFF**: las pantallas hablan con `/api/erp/*` y el Route
Handler habla con Odoo 18 por JSON-RPC. No hay datos de demostración.

La documentación funcional y técnica vive en el vault de Obsidian, en
`../altitud/`. Empieza por `Inicio.md`.

## Levantar

Necesitas el Odoo de `../odoo` corriendo (`docker compose up -d` dentro de esa
carpeta) y la base `altitud` configurada:

```bash
cd ../odoo/scripts
python3 setup_base.py        # grupos, razones sociales, parámetros
python3 seed_catalogos.py     # servicios, personal, proveedores, insumos
```

Después, el front:

```bash
cp ../.env.example .env.local   # y llena AUTH_SECRET y la conexión a Odoo
npm install
npm run dev                     # http://localhost:3001
```

Se entra con un usuario de Odoo (`res.users`) y su contraseña. El rol de la
app sale del campo `x_app_role` del usuario.

## Cómo está armado

```
Página (cliente)
    →  src/services/*.ts            contrato { action, payload }
        →  POST /api/erp/<dominio>  Route Handler: exige sesión y permiso
            →  src/server/erp/*.ts  despachador contra Odoo
                →  src/lib/odoo/client.ts   JSON-RPC
```

| Capa | Dónde |
|---|---|
| Pantallas | `src/app/(app)/` |
| Servicios que consume la UI | `src/services/` |
| Contrato de respuesta | `src/types/altitude.ts` |
| Despachadores del ERP | `src/server/erp/` |
| Cliente de Odoo | `src/lib/odoo/` |
| Fórmulas del negocio | `src/lib/compute.ts` |
| Sesión y permisos | `src/lib/auth/` |
| Addon de Odoo | `../odoo/addons/altitud_base` |

Las fórmulas (presupuesto devengado, costo estimado al cierre, margen) se
calculan en `src/lib/compute.ts`, no en Odoo. El panel nativo de rentabilidad
de Odoo usa otro criterio y puede enseñar cifras distintas: la cifra oficial
es la de la app.

## Probar el flujo completo

Con el front corriendo:

```bash
bash ../scripts/smoke_flujo.sh
```

Levanta un cliente, lo cotiza, autoriza, arma cuadrilla, marca asistencia,
carga una compra y un gasto, avanza fases, cobra extras y cierra; y revisa que
el panel, los reportes y la prenómina cuadren. Deja datos en la base; para
borrarlos sin tocar los catálogos:

```bash
cd ../odoo/scripts && python3 limpiar_operacion.py
```

## Fuera de alcance (acordado)

- Almacén con entradas, salidas o CEDIS. El conteo de insumos es solo un
  número para reponer.
- Timbrado de nómina. La prenómina se entrega al despacho.
- Emisión de CFDI. La facturación se queda en CONTPAQi; aquí solo se guarda
  monto, folio y UUID para comparar contra el costo.
