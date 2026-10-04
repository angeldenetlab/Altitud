import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Compass className="size-7" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">Página no encontrada</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          La página que buscas no existe o fue movida.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href="/dashboard" />}>Ir al panel general</Button>
    </div>
  );
}
