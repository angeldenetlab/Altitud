"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/nav";
import { useAuth } from "@/hooks/useAuth";
import { canAccessModule } from "@/lib/auth/rbac";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, session } = useAuth();

  const visibleItems = navItems.filter((item) => {
    if (!session?.role) return true;
    return canAccessModule(session.role, item.href);
  });

  async function handleLogout() {
    await logout();
    onNavigate?.();
    router.replace("/login");
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_0%_0%,color-mix(in_oklch,var(--sidebar-primary),transparent_88%),transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:repeating-linear-gradient(135deg,transparent_0,transparent_3px,white_4px,transparent_5px)]"
      />

      <div className="relative flex h-16 shrink-0 items-center px-3.5">
        <BrandLogo inverse className="md:hidden" />
        <BrandLogo
          compact
          inverse
          className="hidden md:block md:group-hover/sidebar:hidden md:group-focus-within/sidebar:hidden"
        />
        <BrandLogo
          inverse
          className="hidden md:group-hover/sidebar:block md:group-focus-within/sidebar:block"
        />
      </div>

      <div className="relative mx-3 mb-2 h-px shrink-0 bg-white/[0.08]" />

      <nav className="relative flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-1.5 scrollbar-thin">
        <ul className="flex flex-col gap-1">
          {visibleItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  title={item.label}
                  className={cn(
                    "group/item relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm transition-all duration-150",
                    active
                      ? "bg-white/[0.1] font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]"
                      : "text-sidebar-foreground/60 hover:bg-white/[0.06] hover:text-white"
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-primary transition-all duration-150",
                      active ? "opacity-100" : "opacity-0 group-hover/item:opacity-30"
                    )}
                  />
                  <Icon
                    className={cn(
                      "size-[18px] shrink-0 transition-transform duration-150 group-hover/item:scale-[1.08]",
                      active ? "text-sidebar-primary" : ""
                    )}
                    strokeWidth={active ? 2.1 : 1.75}
                  />
                  <span className="truncate whitespace-nowrap">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="relative shrink-0 border-t border-white/[0.08] p-2.5">
        <button
          type="button"
          onClick={handleLogout}
          title="Cerrar sesión"
          className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm text-sidebar-foreground/60 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white"
        >
          <LogOut className="size-[18px] shrink-0" strokeWidth={1.75} />
          <span className="truncate whitespace-nowrap">Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
}
