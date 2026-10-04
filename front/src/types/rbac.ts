import type { AppRole } from "./roles";

export type AppModuleRoute =
  | "/panel"
  | "/proyectos"
  | "/cotizaciones"
  | "/ordenes"
  | "/clientes"
  | "/asistencias"
  | "/compras"
  | "/prenomina"
  | "/reportes"
  | "/catalogos";

export type PermissionCode =
  | "panel.read"
  | "proyectos.read" | "proyectos.write"
  /** Mover etapa, autorizar extras y cerrar el proyecto. [R-07] */
  | "proyectos.close"
  | "cotizaciones.read" | "cotizaciones.write"
  /** Visto bueno del socio en el flujo de autorización. [R-13] */
  | "cotizaciones.approve"
  | "clientes.read" | "clientes.write"
  | "asistencias.read" | "asistencias.write"
  | "compras.read" | "compras.write"
  | "prenomina.read"
  | "reportes.read"
  | "catalogos.read" | "catalogos.write";

export interface RoleConfig {
  role: AppRole;
  modules: AppModuleRoute[];
  permissions: PermissionCode[];
}
