"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { LevantamientoForm } from "@/components/levantamientos/LevantamientoForm";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { canPerform } from "@/lib/auth/rbac";
import { projectsService } from "@/services/projectsService";

export default function LevantamientoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const router = useRouter();
  const { session } = useAuth();
  const canWrite = session ? canPerform(session.role, "levantamientos.write") : false;

  const query = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsService.get(projectId),
    enabled: Number.isFinite(projectId),
  });

  const project = query.data;

  useEffect(() => {
    if (!project) return;
    if (project.stage !== "levantamiento") {
      router.replace(`/proyectos/${project.id}`);
    }
  }, [project, router]);

  if (query.isLoading) {
    return <Skeleton className="mx-auto h-96 w-full max-w-xl" />;
  }

  if (!project) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        No se encontró el levantamiento.
      </p>
    );
  }

  if (project.stage !== "levantamiento") {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">Abriendo la ficha…</p>
    );
  }

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
        <p className="font-mono text-xs font-semibold text-primary">{project.folio}</p>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Completar levantamiento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sigue en espera de cotización. Fotos y medidas se pueden completar aquí.
        </p>
      </div>
      <LevantamientoForm project={project} defaultDoneBy={session?.name} canWrite={canWrite} />
    </div>
  );
}
