"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LevantamientoForm } from "@/components/levantamientos/LevantamientoForm";
import { useAuth } from "@/hooks/useAuth";
import { canPerform } from "@/lib/auth/rbac";

export default function NuevoLevantamientoPage() {
  const { session } = useAuth();
  const canWrite = session ? canPerform(session.role, "levantamientos.write") : false;

  return (
    <div className="mx-auto grid w-full max-w-xl gap-4">
      <Link
        href="/levantamientos"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Pendientes
      </Link>
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Levantar sitio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Medidas, condiciones y fotos. La cotización se arma después, en oficina.
        </p>
      </div>
      {canWrite ? (
        <LevantamientoForm defaultDoneBy={session?.name} canWrite />
      ) : (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Tu perfil puede leer levantamientos, no capturarlos.
        </p>
      )}
    </div>
  );
}
