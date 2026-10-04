"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mountain } from "lucide-react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { MobileDock } from "@/components/layout/MobileDock";
import { SidebarDock } from "@/components/layout/SidebarDock";
// Sidebar clásico: se queda importable para volver a él (ver bloque comentado abajo).
// import { SidebarNav } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useAuth } from "@/hooks/useAuth";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Mountain className="size-6" />
        </div>
        <Loader2 className="size-5 animate-spin" />
        <p className="text-sm">Verificando sesión…</p>
      </div>
    );
  }

  if (status === "anonymous") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <p className="text-sm">Redirigiendo al login…</p>
      </div>
    );
  }

  return (
    <div className="app-canvas relative flex min-h-screen flex-col overflow-x-clip">
      {/* Ambient brand gradient — same treatment as the login, adapts to light/dark tokens.
          Wrapped in an inset-0 overflow-hidden layer so the oversized blur circles are
          clipped and never create horizontal page scroll.
          It's a background sibling of <main>, so it does NOT break sticky descendants. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden print:hidden">
        <div
          className="absolute -left-40 -top-40 size-[32rem] rounded-full blur-3xl"
          style={{ background: "color-mix(in oklch, var(--primary) 16%, transparent)" }}
        />
        <div
          className="absolute -right-32 top-1/3 size-[34rem] rounded-full blur-3xl"
          style={{ background: "color-mix(in oklch, var(--accent) 14%, transparent)" }}
        />
      </div>
      {/* La topbar va de lado a lado: el riel flota debajo de ella y ya no hay una
          franja que la empuje, así la esquina superior izquierda no queda como un
          hueco con el lienzo al aire. */}
      <div className="print:hidden">
        <Topbar />
      </div>
      <div className="relative flex min-w-0 flex-1">
        {/* Riel estilo dock. Para volver al sidebar clásico, descomenta el bloque
            de abajo (y su import) y quita SidebarDock + el spacer. */}
        <div className="hidden w-[5.5rem] shrink-0 print:hidden md:block" aria-hidden />
        <div className="hidden md:contents print:hidden">
          <SidebarDock />
        </div>
        {/*
        <aside className="hidden w-16 shrink-0 print:hidden md:block">
          <div className="group/sidebar fixed inset-y-0 left-0 z-30 w-16 overflow-hidden border-r border-sidebar-border bg-sidebar shadow-sm transition-[width] duration-200 ease-out hover:w-60 hover:shadow-2xl focus-within:w-60">
            <SidebarNav />
          </div>
        </aside>
        */}
        {/* pb-28: en el celular el dock flota abajo y no debe tapar el final de la página. */}
        <main className="relative z-[1] min-w-0 flex-1 p-4 pb-28 md:p-6 print:p-0">
          <RoleGuard>{children}</RoleGuard>
        </main>
      </div>
      <MobileDock />
    </div>
  );
}
