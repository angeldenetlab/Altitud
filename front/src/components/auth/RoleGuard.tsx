"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { canAccessModule, homePathForRole } from "@/lib/auth/rbac";

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const { session, status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const allowed =
    status === "authenticated" &&
    session?.role &&
    canAccessModule(session.role, pathname);

  useEffect(() => {
    if (status !== "authenticated" || !session?.role) return;
    if (!canAccessModule(session.role, pathname)) {
      router.replace(homePathForRole(session.role));
    }
  }, [status, session?.role, pathname, router]);

  if (!allowed) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <p className="text-sm">Verificando permisos…</p>
      </div>
    );
  }

  return <>{children}</>;
}
