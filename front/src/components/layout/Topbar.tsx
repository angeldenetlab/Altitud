"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Moon, Sun, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { SidebarNav } from "@/components/layout/Sidebar";
import { NotificationBell } from "@/components/bitacora/NotificationBell";
import { brand, navItems } from "@/lib/nav";
import { useAuth } from "@/hooks/useAuth";
import { getRoleLabel } from "@/lib/auth/roles";

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function Topbar() {
  const pathname = usePathname();
  const { session, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const current = navItems.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  const isDark = resolvedTheme === "dark";

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border/80 bg-background/75 px-4 shadow-[0_1px_0_rgba(15,23,42,.02)] backdrop-blur-xl md:px-6">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="size-5" />
        </Button>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <h1 className="truncate font-heading text-lg font-bold tracking-tight md:text-xl">
          {current?.label ?? brand.name}
        </h1>
        {current?.description && (
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            {current.description}
          </p>
        )}
      </div>

      <NotificationBell />

      <Button
        variant="ghost"
        size="icon"
        aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="rounded-full text-muted-foreground hover:text-foreground"
      >
        <Sun className="size-[18px] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute size-[18px] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      </Button>

      <div className="h-6 w-px bg-border" aria-hidden />

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-1 pr-2.5 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:bg-muted">
          <Avatar size="sm" className="ring-2 ring-primary/15">
            <AvatarFallback className="bg-primary/10 font-heading text-[11px] font-bold text-primary">
              {initials(session?.name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">
            {session?.name ?? "Usuario"}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {/* Menu.GroupLabel exige un Menu.Group como padre; sin él Base UI lanza el error #31. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center gap-2 px-2 py-1.5 text-foreground">
              <UserRound className="size-3.5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {session?.name ?? "Usuario"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {session?.email}
                </p>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          {session?.role ? (
            <div className="px-2 pb-1.5">
              <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                {getRoleLabel(session.role)}
              </span>
            </div>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {isDark ? "Modo claro" : "Modo oscuro"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => logout()}>
            <LogOut className="size-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
