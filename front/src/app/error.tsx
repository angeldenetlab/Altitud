"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-5 text-center">
      <AlertTriangle className="mx-auto size-10 text-destructive" />
      <h1 className="font-heading text-xl font-bold">Algo salió mal</h1>
      <p className="text-sm text-muted-foreground">
        {error.message || "No se pudo cargar la pantalla."}
      </p>
      <Button type="button" onClick={reset} className="w-full">
        <RotateCw className="size-5" />
        Reintentar
      </Button>
    </main>
  );
}
