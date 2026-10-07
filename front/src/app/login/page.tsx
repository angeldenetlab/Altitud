"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Check,
  Eye,
  EyeOff,
  HardHat,
  Lightbulb,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  SprayCan,
  TriangleAlert,
  UserRound,
  Wrench,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { homePathForRole } from "@/lib/auth/rbac";
import { useAuthStore } from "@/store/authStore";
import type { AppRole } from "@/types/roles";

function landingPath(next: string | null, role?: AppRole): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return role ? homePathForRole(role) : "/panel";
}

const highlights = [
  { icon: HardHat, label: "Trabajos de altura" },
  { icon: SprayCan, label: "Limpieza fina" },
  { icon: Wrench, label: "Obra y acabados" },
];

/** Modo demostración: sin ERP detrás, con perfiles de ejemplo. [R-33] */
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const DEMO_USERS = [
  { login: "socio", label: "Socio" },
  { login: "control", label: "Control de proyectos" },
  { login: "admin", label: "Administración" },
  { login: "tesoreria", label: "Tesorería" },
  { login: "campo", label: "Supervisor de campo" },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, status, session } = useAuth();
  const loginAttemptRef = useRef(false);

  useEffect(() => {
    if (status === "authenticated" && !loginAttemptRef.current) {
      router.replace(landingPath(searchParams.get("next"), session?.role));
    }
  }, [status, session?.role, router, searchParams]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    loginAttemptRef.current = true;
    setError(null);
    setSubmitting(true);

    try {
      await login(username.trim(), password);
      setSuccess(true);
      await new Promise((resolve) => setTimeout(resolve, 450));
      router.replace(landingPath(searchParams.get("next"), useAuthStore.getState().session?.role));
    } catch (err) {
      loginAttemptRef.current = false;
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background font-sans">
      <div
        aria-hidden
        className="absolute -left-40 -top-40 size-[34rem] rounded-full blur-3xl"
        style={{ background: "color-mix(in oklch, var(--primary) 26%, transparent)" }}
      />
      <div
        aria-hidden
        className="absolute -bottom-48 -right-32 size-[36rem] rounded-full blur-3xl"
        style={{ background: "color-mix(in oklch, var(--accent) 24%, transparent)" }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklch,var(--foreground)_6%,transparent)_1px,transparent_0)] bg-[size:26px_26px] opacity-40"
      />

      <div className="relative z-[1] flex min-h-screen flex-col">
        <div className="flex items-center justify-between px-5 pt-5 sm:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
            <Building2 className="size-3.5" />
            Control de proyectos y costos
          </span>
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-1 items-center px-5 py-10 sm:px-8">
          <div className="grid w-full items-center gap-14 lg:grid-cols-2">
            <div className="hidden flex-col lg:flex">
              <BrandLogo size="lg" />
              <h1 className="mt-8 font-heading text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground">
                Saber si el trabajo{" "}
                <span className="text-primary">ganó o perdió dinero</span>
              </h1>
              <p className="mt-4 max-w-md text-[15px] text-muted-foreground">
                Un folio por proyecto, el presupuesto contra el gasto real partida por
                partida y el cierre que dice la rentabilidad. Las tres áreas en el mismo
                módulo.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {highlights.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-3.5 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur-sm"
                  >
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-3.5" />
                    </span>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="mx-auto w-full max-w-sm">
              <div className="mb-6 flex flex-col items-center gap-1 lg:hidden">
                <BrandLogo size="lg" />
              </div>

              <div className="animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-border bg-card p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_28px_56px_-28px_rgba(15,23,42,0.18)] duration-500 dark:shadow-[0_28px_56px_-28px_rgba(0,0,0,0.7)]">
                <div className="mb-6 text-center">
                  <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
                    Bienvenido
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Entra con tu cuenta del sistema
                  </p>
                </div>

                <form onSubmit={handleSubmit} aria-busy={submitting} className="flex flex-col gap-4">
                  {error ? (
                    <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/[0.07] px-3.5 py-3 text-sm text-destructive">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  ) : null}

                  <div className="grid gap-1.5">
                    <Label htmlFor="username" className="text-xs font-medium text-muted-foreground">
                      Usuario o correo
                    </Label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="username"
                        placeholder="usuario@altitude.mx"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        autoComplete="username"
                        className="h-11 rounded-lg pl-9"
                        disabled={success}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                      Contraseña
                    </Label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        className="h-11 rounded-lg pl-9 pr-10"
                        disabled={success}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        className="absolute right-2.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        disabled={success}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {DEMO_MODE ? (
                    <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                      <p className="flex items-start gap-2">
                        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-accent-foreground" />
                        <span>
                          <span className="font-semibold text-foreground">Demostración:</span>{" "}
                          cualquier contraseña funciona. Elige el perfil con el que quieres
                          entrar:
                        </span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {DEMO_USERS.map((user) => (
                          <button
                            key={user.login}
                            type="button"
                            onClick={() => {
                              setUsername(user.login);
                              setPassword("demo");
                            }}
                            className="rounded-full border border-border bg-card px-2.5 py-1 font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                          >
                            {user.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <Button
                    type="submit"
                    className="mt-1 h-11 w-full rounded-lg font-semibold"
                    disabled={submitting || success}
                  >
                    {submitting && !success ? <Loader2 className="size-4 animate-spin" /> : null}
                    {success ? <Check className="size-4" /> : null}
                    {success ? "Acceso confirmado" : submitting ? "Verificando…" : "Entrar"}
                  </Button>
                </form>
              </div>

              <div className="mt-5 flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">
                  <ShieldCheck className="size-3.5 text-success" />
                  {DEMO_MODE ? "Ambiente de demostración · datos de ejemplo" : "Conexión segura"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
