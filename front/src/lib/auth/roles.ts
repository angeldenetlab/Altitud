import type { AppRole } from "@/types/roles";

export const ALL_APP_ROLES: readonly AppRole[] = [
  "socio",
  "control",
  "admin",
  "tesoreria",
  "campo",
];

export const ROLE_LABELS: Record<AppRole, string> = {
  socio: "Socio / Dirección",
  control: "Control de proyectos",
  admin: "Administración",
  tesoreria: "Tesorería",
  campo: "Supervisor de campo",
};

const KNOWN_ROLES = new Set<string>(ALL_APP_ROLES);

export function isAppRole(value: string): value is AppRole {
  return KNOWN_ROLES.has(value);
}

export function normalizeAppRole(raw: string | false | undefined | null): AppRole {
  if (!raw || typeof raw !== "string") return "control";
  const slug = raw.trim().toLowerCase();
  return isAppRole(slug) ? slug : "control";
}

export function getRoleLabel(role: AppRole | string): string {
  return isAppRole(role) ? ROLE_LABELS[role] : role;
}
