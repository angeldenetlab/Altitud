import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar · Levantamientos" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getSession()) redirect("/levantamientos");

  const { next } = await searchParams;
  const target = next?.startsWith("/levantamientos") ? next : "/levantamientos";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-10">
      <header className="text-center">
        <Image
          src="/brand/logo-altitude.svg"
          alt="Altitud"
          width={132}
          height={36}
          priority
          style={{ height: "auto" }}
          className="mx-auto h-9 w-auto dark:brightness-0 dark:invert"
        />
        <h1 className="mt-6 font-heading text-2xl font-bold">Levantamientos</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          El sitio se captura aquí. La cotización sale de oficina.
        </p>
      </header>

      <div className="surface-elevated rounded-2xl p-5">
        <LoginForm next={target} />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        ¿No puedes entrar? Pide a oficina que ligue tu colaborador a tu usuario de Odoo.
      </p>
    </main>
  );
}
