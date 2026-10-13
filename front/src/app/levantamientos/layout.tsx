import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/server/session";
import { logout } from "../login/actions";

/** Shell de campo: una columna, encabezado fijo y nada que estorbe al pulgar. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-xl items-center gap-3 px-4">
          <Link href="/levantamientos" className="flex shrink-0 items-center gap-2">
            <Image
              src="/brand/logo-altitude.svg"
              alt="Altitud"
              width={24}
              height={24}
              className="size-6 shrink-0 dark:brightness-0 dark:invert"
            />
          </Link>
          <p className="min-w-0 flex-1 truncate text-right text-sm text-muted-foreground">
            {session.employeeName}
          </p>
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              aria-label="Salir"
              title="Salir"
              className="-mr-2"
            >
              <LogOut className="size-5" />
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-5">{children}</main>
    </div>
  );
}
