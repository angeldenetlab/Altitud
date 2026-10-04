# Altitude · Integración con Odoo

> Esta guía describía la integración **antes** de hacerla, cuando el front
> respondía con datos de demostración. Ya no aplica: el mock se eliminó y el
> BFF habla con Odoo 18.
>
> La documentación viva está en el vault de Obsidian, en `../../altitud/`:
>
> - **`Integracion con Odoo Proyectos.md`** — la decisión, el mapeo campo por
>   campo, los huecos que cubre el addon `altitud_base` y por qué.
> - **`Arquitectura.md`** — las capas del front y qué hace cada una.
> - **`Reglas de negocio.md`** — las fórmulas que el BFF calcula.
> - **`Puntos de implementacion.md`** — qué quedó hecho y qué sigue pendiente.
> - Una nota por módulo en `modulos/`.

En corto, para no tener que abrir el vault:

```
Página (cliente)
    →  src/services/*.ts            contrato { action, payload }
        →  POST /api/erp/<dominio>  Route Handler: exige sesión y permiso
            →  src/server/erp/*.ts  despachador contra Odoo
                →  src/lib/odoo/client.ts   JSON-RPC
```

El addon propio vive en `../../odoo/addons/altitud_base` y cubre lo que Odoo
no trae: folio y área del proyecto, presupuesto con cantidad y costo unitario,
cuadrilla, jornada (completa / media / falta) y el puente que convierte cada
asistencia en el costo de mano de obra del proyecto.
