"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Dock, DockIcon, DockItem } from "@/components/ui/dock";
import { dockItemClass } from "@/components/layout/SidebarDock";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/nav";
import { useAuth } from "@/hooks/useAuth";
import { canAccessModule } from "@/lib/auth/rbac";

/**
 * Navegación en el celular: el mismo dock flotante del riel, abajo y al
 * centro, donde llega el pulgar.
 *
 * Lleva todos los módulos del rol. Diez iconos no caben en un teléfono, así
 * que el dock se desliza de lado dentro de su cápsula y, al cambiar de vista,
 * se centra solo en el módulo activo. Los bordes se desvanecen para que se lea
 * que hay más de lado.
 *
 * Sin `DockLabel`: en pantalla táctil no hay hover que lo muestre, y dentro de
 * un contenedor con scroll se recortaría. El nombre del módulo ya está en la
 * topbar y cada icono lleva su `aria-label`.
 */

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function ActiveDot() {
  return (
    <motion.span
      layoutId="mobile-dock-indicator"
      aria-hidden
      transition={{ type: "spring", stiffness: 500, damping: 38 }}
      className="pointer-events-none absolute -bottom-2 left-1/2 size-1 -translate-x-1/2 rounded-full bg-sidebar-primary"
    />
  );
}

export function MobileDock() {
  const pathname = usePathname();
  const { session } = useAuth();
  const scrollerRef = useRef<HTMLDivElement>(null);

  const visibleItems = navItems.filter((item) => {
    if (!session?.role) return true;
    return canAccessModule(session.role, item.href);
  });

  useEffect(() => {
    const active = scrollerRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    // `block: "nearest"` para que no mueva la página en vertical, solo el dock.
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [pathname]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))] print:hidden md:hidden">
      <div
        className={cn(
          "pointer-events-auto max-w-full overflow-hidden",
          // El cristal va en la cápsula y no en el panel del dock: así el
          // contorno se queda quieto mientras los iconos se deslizan dentro.
          "isolate rounded-[1.75rem] border border-white/10 ring-1 ring-inset ring-white/[0.06]",
          "bg-sidebar/85 backdrop-blur-xl supports-[backdrop-filter]:bg-sidebar/70",
          "shadow-[0_8px_24px_rgba(15,23,42,0.18)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.45)]",
        )}
      >
        <div
          ref={scrollerRef}
          className="overflow-x-auto overscroll-x-contain [mask-image:linear-gradient(to_right,transparent,black_14px,black_calc(100%-14px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Dock
            aria-label="Módulos"
            className="items-end gap-2.5 rounded-none bg-transparent px-3.5 pb-3 dark:bg-transparent"
            magnification={40}
            expandOnHover={false}
            panelHeight={62}
          >
            {visibleItems.map((item) => {
              const active = isActiveRoute(pathname, item.href);
              const Icon = item.icon;
              return (
                <DockItem
                  key={item.href}
                  href={item.href}
                  active={active}
                  aria-label={item.label}
                  className={dockItemClass(active)}
                  badge={active ? <ActiveDot /> : null}
                >
                  <DockIcon>
                    <Icon className="h-full w-full" strokeWidth={active ? 2.1 : 1.75} />
                  </DockIcon>
                </DockItem>
              );
            })}
          </Dock>
        </div>
      </div>
    </div>
  );
}
