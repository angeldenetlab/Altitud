"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { type LoginState, login } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      <LogIn className="size-5" />
      {pending ? "Entrando…" : "Entrar"}
    </Button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(login, { error: null });

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="next" value={next} />

      <Field label="Usuario">
        <Input
          name="login"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="tu.correo@altitud.mx"
          required
        />
      </Field>

      <Field label="Contraseña" hint="La misma de Odoo.">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>

      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
