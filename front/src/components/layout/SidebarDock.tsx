"use client";

import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Dock, DockIcon, DockItem, DockLabel } from "@/components/ui/dock";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/nav";
import { useAuth } from "@/hooks/useAuth";
import { canAccessModule } from "@/lib/auth/rbac";

/**
 * Riel de módulos hecho con el dock.
 *
 * Los módulos van sin fondo y solo el activo se rellena con el acento: con diez
 * azulejos iguales la columna se leía como una pared de botones y el activo no
 * saltaba a la vista. La barrita a la izquierda del activo se desliza entre
 * módulos al navegar, para que el ojo siga el cambio.
 *
 * Sin separadores por bloque: `navItems` no agrupa los módulos en secciones.
 */

export const DOCK_LABEL_CLASS = "border-white/10 bg-sidebar text-sidebar-foreground shadow-lg";

export function dockItemClass(active: boolean) {
  return cn(
    "rounded-xl transition-colors duration-150",
    active
      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_6px_18px_-6px_color-mix(in_oklch,var(--sidebar-primary),transparent_35%)]"
      : "text-sidebar-foreground/65 hover:bg-white/[0.08] hover:text-white",
  );
}

function ActiveIndicator() {
  return (
    <motion.span
      layoutId="sidebar-active-indicator"
      aria-hidden
      transition={{ type: "spring", stiffness: 500, damping: 38 }}
      className="pointer-events-none absolute -left-[9px] top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-primary"
    />
  );
}

function RailDivider() {
  return <div className="mx-auto my-1 h-px w-6 shrink-0 bg-white/10" aria-hidden />;
}

export function SidebarDock() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, session } = useAuth();

  const visibleItems = navItems.filter((item) => {
    if (!session?.role) return true;
    return canAccessModule(session.role, item.href);
  });

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <aside
      className={cn(
        "fixed left-3 top-[calc(50%+2rem)] z-30 flex w-16 -translate-y-1/2 flex-col items-center overflow-visible print:hidden",
        // Cristal flotante separado de los bordes en lugar de una franja pegada
        // a la pantalla. Se centra en el área bajo la topbar (h-16), no en toda
        // la ventana.
        "isolate rounded-[1.75rem] border border-white/10 ring-1 ring-inset ring-white/[0.06]",
        "bg-sidebar/85 text-sidebar-foreground backdrop-blur-xl supports-[backdrop-filter]:bg-sidebar/70",
        "shadow-[0_8px_24px_rgba(15,23,42,0.18)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.45)]",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(140%_35%_at_50%_0%,color-mix(in_oklch,var(--sidebar-primary),transparent_85%),transparent_70%)]"
      />

      <div className="relative flex w-full shrink-0 items-center justify-center pb-1 pt-3">
        <BrandLogo compact inverse />
      </div>

      <RailDivider />
      <nav className="relative flex w-full flex-col items-center overflow-visible py-1">
        <Dock
          orientation="vertical"
          aria-label="Módulos"
          className="h-auto items-center gap-1.5"
          magnification={54}
          distance={110}
          panelWidth={40}
        >
          {visibleItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <DockItem
                key={item.href}
                href={item.href}
                active={active}
                aria-label={item.label}
                className={dockItemClass(active)}
                badge={active ? <ActiveIndicator /> : null}
              >
                <DockLabel className={DOCK_LABEL_CLASS}>{item.label}</DockLabel>
                <DockIcon>
                  <Icon className="h-full w-full" strokeWidth={active ? 2.1 : 1.75} />
                </DockIcon>
              </DockItem>
            );
          })}
        </Dock>
      </nav>

      <RailDivider />

      <div className="relative flex w-full shrink-0 justify-center overflow-visible pb-3 pt-1">
        <Dock
          orientation="vertical"
          aria-label="Sesión"
          className="items-center"
          magnification={48}
          distance={90}
          panelWidth={40}
        >
          <DockItem
            aria-label="Cerrar sesión"
            onClick={handleLogout}
            className="rounded-xl text-sidebar-foreground/45 transition-colors duration-150 hover:bg-destructive/15 hover:text-destructive"
          >
            <DockLabel className={DOCK_LABEL_CLASS}>Cerrar sesión</DockLabel>
            <DockIcon>
              <LogOut className="h-full w-full" strokeWidth={1.75} />
            </DockIcon>
          </DockItem>
        </Dock>
      </div>
    </aside>
  );
}
