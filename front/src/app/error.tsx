"use client";

import { useEffect } from "react";
import { TriangleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <TriangleAlert className="size-7" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">Algo salió mal</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {error.message || "Ocurrió un error inesperado en la aplicación."}
        </p>
      </div>
      <Button onClick={reset}>
        <RotateCcw className="size-4" />
        Reintentar
      </Button>
    </div>
  );
}
