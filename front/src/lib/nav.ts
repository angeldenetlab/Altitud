import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ClipboardList,
  FolderKanban,
  FileText,
  ClipboardCheck,
  Users,
  UserCheck,
  ShoppingCart,
  Wallet,
  BarChart3,
  Settings2,
} from "lucide-react";
import type { AppModuleRoute } from "@/types/rbac";

export interface NavItem {
  href: AppModuleRoute;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  {
    href: "/panel",
    label: "Panel",
    description: "Estado de los proyectos activos",
    icon: LayoutDashboard,
  },
  {
    href: "/levantamientos",
    label: "Levantamientos",
    description: "Captura de sitio en tableta, a la espera de cotización",
    icon: ClipboardList,
  },
  {
    href: "/proyectos",
    label: "Proyectos",
    description: "Folio, etapas, presupuesto vs real y cierre",
    icon: FolderKanban,
  },
  {
    href: "/cotizaciones",
    label: "Cotizaciones",
    description: "Levantamiento, cálculo y autorización",
    icon: FileText,
  },
  {
    href: "/ordenes",
    label: "Órdenes de venta",
    description: "Pedidos confirmados y listos para ejecutar",
    icon: ClipboardCheck,
  },
  {
    href: "/clientes",
    label: "Clientes",
    description: "Directorio de clientes y contactos",
    icon: Users,
  },
  {
    href: "/asistencias",
    label: "Asistencias",
    description: "Distribución del personal y costo de mano de obra",
    icon: UserCheck,
  },
  {
    href: "/compras",
    label: "Compras",
    description: "Compras por proyecto e insumos",
    icon: ShoppingCart,
  },
  {
    href: "/prenomina",
    label: "Prenómina",
    description: "Jornales del periodo para el despacho",
    icon: Wallet,
  },
  {
    href: "/reportes",
    label: "Reportes",
    description: "Rentabilidad por proyecto y por servicio",
    icon: BarChart3,
  },
  {
    href: "/catalogos",
    label: "Catálogos",
    description: "Servicios, paramétricos, personal y accesos",
    icon: Settings2,
  },
];

export const brand = {
  name: "Altitude",
  shortName: "ALT",
  tagline: "Altura · Limpieza · Obra",
  product: "Altitude · Control de proyectos",
} as const;
