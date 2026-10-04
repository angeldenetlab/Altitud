/**
 * Roles y accesos diferenciados. [R-33]
 *
 * `socio` cubre a los tres socios; `control` es control de proyectos;
 * `campo` es el supervisor que captura asistencia y evidencias.
 */
export type AppRole = "socio" | "control" | "admin" | "tesoreria" | "campo";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  /** Razón social con la que entra por defecto. [R-37] */
  company: "altitude" | "servicios" | "ambas";
}
