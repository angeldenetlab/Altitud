import type { AppRole } from "@/types/roles";
import type { AppModuleRoute, PermissionCode, RoleConfig } from "@/types/rbac";
import { normalizeAppRole } from "@/lib/auth/roles";

const allModules: AppModuleRoute[] = [
  "/panel",
  "/proyectos",
  "/cotizaciones",
  "/ordenes",
  "/clientes",
  "/asistencias",
  "/compras",
  "/prenomina",
  "/reportes",
  "/catalogos",
];

const allPermissions: PermissionCode[] = [
  "panel.read",
  "proyectos.read",
  "proyectos.write",
  "proyectos.close",
  "cotizaciones.read",
  "cotizaciones.write",
  "cotizaciones.approve",
  "clientes.read",
  "clientes.write",
  "asistencias.read",
  "asistencias.write",
  "compras.read",
  "compras.write",
  "prenomina.read",
  "reportes.read",
  "catalogos.read",
  "catalogos.write",
];

/** Matriz rol → módulos + permisos. [R-33] */
export const roleMatrix: RoleConfig[] = [
  {
    role: "socio",
    modules: [...allModules],
    permissions: [...allPermissions],
  },
  {
    role: "control",
    modules: ["/panel", "/proyectos", "/cotizaciones", "/ordenes", "/clientes", "/asistencias", "/compras", "/reportes", "/catalogos"],
    permissions: [
      "panel.read",
      "proyectos.read",
      "proyectos.write",
      "cotizaciones.read",
      "cotizaciones.write",
      "clientes.read",
      "clientes.write",
      "asistencias.read",
      "asistencias.write",
      "compras.read",
      "compras.write",
      "reportes.read",
      "catalogos.read",
    ],
  },
  {
    role: "admin",
    modules: ["/panel", "/proyectos", "/cotizaciones", "/ordenes", "/clientes", "/compras", "/prenomina", "/reportes", "/catalogos"],
    permissions: [
      "panel.read",
      "proyectos.read",
      "proyectos.write",
      "cotizaciones.read",
      "cotizaciones.write",
      "clientes.read",
      "clientes.write",
      "compras.read",
      "compras.write",
      "prenomina.read",
      "reportes.read",
      "catalogos.read",
      "catalogos.write",
    ],
  },
  {
    role: "tesoreria",
    modules: ["/panel", "/proyectos", "/compras", "/prenomina", "/reportes"],
    permissions: [
      "panel.read",
      "proyectos.read",
      "compras.read",
      "prenomina.read",
      "reportes.read",
    ],
  },
  {
    role: "campo",
    modules: ["/panel", "/proyectos", "/asistencias"],
    permissions: [
      "panel.read",
      "proyectos.read",
      "proyectos.write",
      "asistencias.read",
      "asistencias.write",
    ],
  },
];

export function getRoleConfig(role: AppRole): RoleConfig {
  const normalized = normalizeAppRole(role);
  return (
    roleMatrix.find((entry) => entry.role === normalized) ??
    roleMatrix.find((entry) => entry.role === "control")!
  );
}

export function canAccessModule(role: AppRole, pathname: string): boolean {
  return getRoleConfig(role).modules.some((module) => pathname.startsWith(module));
}

export function canPerform(role: AppRole, permission: PermissionCode): boolean {
  return getRoleConfig(normalizeAppRole(role)).permissions.includes(permission);
}
