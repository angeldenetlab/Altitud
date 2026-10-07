"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Mountain } from "lucide-react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { canAccessModule } from "@/lib/auth/rbac";

/**
 * Shell de campo: sin el rail del BFF. Una columna, tableta, teclado y cámara.
 */
export default function CampoLayout({ children }: { children: React.ReactNode }) {
  const { status, session, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login?next=/levantamientos");
    }
  }, [status, router]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted-foreground">
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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <p className="text-sm">Redirigiendo al login…</p>
      </div>
    );
  }

  const officeHref =
    session && canAccessModule(session.role, "/proyectos") ? "/proyectos" : "/panel";

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="app-canvas relative flex min-h-dvh flex-col overflow-x-clip">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/80 bg-background/80 px-4 backdrop-blur-xl">
        <BrandLogo compact />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">Campo</p>
        <Link
          href={officeHref}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Oficina
        </Link>
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Cerrar sesión">
          <LogOut className="size-4" />
        </Button>
      </header>
      <main className="relative z-[1] min-w-0 flex-1 px-4 py-5">
        <RoleGuard>{children}</RoleGuard>
      </main>
    </div>
  );
}
