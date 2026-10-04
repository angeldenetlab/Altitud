# Altitude · Requerimientos y dónde se ven

Mapa de los requerimientos levantados contra las pantallas. Sirve para
recorrer el sistema con el cliente sin perderse nada.

> La columna «dónde se ve» sigue vigente: las pantallas no cambiaron al
> conectar Odoo. Lo que sí cambió es que los datos ya no son de ejemplo, así
> que los folios y los importes son los que tenga la base. La excepción es
> R-18: el canal de WhatsApp no se implementó; la captura de asistencia es el
> portal, sobre la cuadrilla del proyecto. Ver `Asistencias.md` en el vault.

| R | Requerimiento | Dónde se ve |
|---|---|---|
| R-01 | Directorio único con folio para todo trabajo | `/proyectos` (lista y kanban); el alta genera folio `PRY-0001`, por chico que sea el trabajo |
| R-02 | Tipificación por área | Badge de área en toda la app; filtro en `/proyectos` |
| R-03 | Presupuesto base desglosado por partidas | `/proyectos/[id]` → **Presupuesto y gasto** → *Editar presupuesto* |
| R-04 | Gasto real contra presupuestado, partida por partida | Misma pestaña: tabla con presupuestado / real / variación y el detalle por renglón |
| R-05 | Avance por fase | `/proyectos/[id]` → **Ejecución** (y resumen en el panel) |
| R-06 | Extras y faltantes | `/proyectos/[id]` → **Ejecución** → *Extras y faltantes*; los extras cobrables se le cotizan con *Cotizar al cliente* y quedan marcados para no cobrarlos dos veces |
| R-07 | Cierre con comparativo y rentabilidad | `/proyectos/[id]` → **Cierre** |
| R-08 | Un solo módulo para las tres áreas | El mismo módulo de proyectos; la estructura de costeo no cambia |
| R-09 | Presupuestos unificados en el sistema | `/cotizaciones`, `/ordenes` (autorizadas) y **desde el proyecto** con *Cotizar al cliente* (extras, trabajo adicional o cotización inicial) |
| R-10 | Paramétricos por servicio | `/catalogos` → *Servicios y paramétricos*; se usan al costear |
| R-11 | Levantamiento delegable | `/cotizaciones/[id]` → *Levantamiento* (fotos y medidas) |
| R-12 | Rendimientos por jornales | Columna *Jornales* del costeo, calculada con el rendimiento del servicio |
| R-13 | Flujo de autorización interna | `/cotizaciones/[id]`: levantamiento → cálculo → VoBo del socio → enviada |
| R-14 | PDF de cotización | Botón *PDF* del detalle (en la demo abre la vista de impresión) |
| R-15 | Seguimiento por folio con estatus | `/cotizaciones` con filtro de estatus. Si la cotización nació de un prospecto, al autorizar **genera** el proyecto; si nació de un proyecto en marcha, **se suma** a lo cobrable de ese proyecto |
| R-16 | Catálogo de servicios | `/catalogos` |
| R-17 | Registro de asistencia | `/asistencias` → *Registrar cuadrilla* |
| R-18 | Captura sin fricción para campo | `/asistencias` → **Cuadrillas** para armar la obra y el alta en lote del día. No hay canal de WhatsApp |
| R-19 | Asistencia ligada a un proyecto | Toda asistencia exige proyecto; se ve en `/proyectos/[id]` → *Asistencias* |
| R-20 | Costo de mano de obra automático | Jornal × jornada, sin captura; alimenta la partida de mano de obra |
| R-21 | Vista diaria de distribución | `/asistencias` → **Distribución del día** (por área y por proyecto) |
| R-22 | Reasignar personal entre proyectos | Selector *Mover…* en cada persona; columna *Sin asignar* |
| R-23 | Compras asignadas a un proyecto con factura | `/compras` → *Registrar compra* |
| R-24 | Sin doble captura | La compra genera el gasto real del proyecto en el momento |
| R-25 | Conteo básico de insumos | `/compras` → **Insumos** (con mínimo de reposición) |
| R-26 | Evidencia fotográfica | `/proyectos/[id]` → **Ejecución** → *Evidencia fotográfica* |
| R-27 | Gastos desde campo | Se listan en `/proyectos/[id]` → **Compras y gastos** |
| R-28 | Marcado de controles y avances en sitio | Botones de avance por fase en **Ejecución** |
| R-29 | Tablero de proyectos activos | `/panel` |
| R-30 | Rentabilidad por proyecto | `/reportes` (tabla ordenada por margen) y el cierre de cada proyecto |
| R-31 | Rentabilidad comparada por tipo de servicio | `/reportes` (gráfica y tarjetas por área) |
| R-32 | Consulta directa sin juntar Excels | Todo el panel y reportes |
| R-33 | Usuarios con roles diferenciados | Login con 5 perfiles; menú y botones cambian por rol. `/catalogos` → *Accesos* |
| R-34 | Base única centralizada | Un solo origen de datos detrás del BFF |
| R-35 | Convivencia con CONTPAQi | Compras guardan folio/UUID; el cierre captura lo facturado. No se emite CFDI aquí |
| R-36 | Prenómina | `/prenomina` (con copiado para el despacho) |
| R-37 | Dos razones sociales | Campo en proyectos y cotizaciones, filtro en `/proyectos`, desglose en prenómina y `/catalogos` |
| R-38 | Directorio de clientes | `/clientes` con alta, folio y ficha con cotizaciones, órdenes y proyectos ligados |

## Recorrido sugerido para la demo (8–10 min)

1. **`/panel`** — “así se ve el negocio hoy”: activos, margen, alertas de sobrecosto.
2. **`/cotizaciones`** → abrir la que está en *Espera VoBo* → mostrar levantamiento,
   costeo con paramétricos y jornales → **Autorizar**: se crea el proyecto con su
   presupuesto base.
3. **`/proyectos`** — kanban: arrastrar el proyecto nuevo a *En ejecución*.
4. **`/asistencias`** — canal de campo: aplicar un mensaje de WhatsApp → se vuelve
   asistencia y sube el costo de mano de obra del proyecto.
5. **`/compras`** — registrar una compra al mismo proyecto.
6. **`/proyectos/[id]`** → *Presupuesto y gasto*: ver cómo la asistencia y la compra
   ya movieron el gasto real; registrar un faltante en *Ejecución*.
7. **Cotizar al cliente** (botón del encabezado del proyecto) → *Extras de obra*:
   se genera la cotización con folio propio; al autorizarla sube lo cobrable del
   **mismo** proyecto y el extra queda marcado como ya cotizado.
8. **Cierre** — capturar lo facturado y ver la rentabilidad final.
9. **`/reportes`** — cerrar con “qué servicio deja más”.
