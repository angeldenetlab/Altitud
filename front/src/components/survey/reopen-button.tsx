"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { reopenSurveyAction } from "@/app/levantamientos/actions";
import { Button } from "@/components/ui/button";

export function ReopenButton({ surveyId }: { surveyId: number }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function reopen() {
    startTransition(async () => {
      const result = await reopenSurveyAction(surveyId);
      if (result.ok) {
        toast.success("Reabierto. Corrige y vuelve a cerrarlo.");
        router.refresh();
      } else {
        toast.error(result.error ?? "No se pudo reabrir.");
      }
    });
  }

  return (
    <Button type="button" variant="outline" onClick={reopen} disabled={pending} className="w-full">
      <Undo2 className="size-5" />
      {pending ? "Reabriendo…" : "Reabrir para corregir"}
    </Button>
  );
}
