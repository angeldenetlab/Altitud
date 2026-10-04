"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { chatterService } from "@/services/chatterService";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Bitácora del registro: notas internas + historial de cambios.
 *
 * Es lo que sostiene la delegación de etapas: quién dijo qué, cuándo cambió
 * de etapa y por qué.
 */
export function Bitacora({
  model,
  resId,
  title = "Bitácora",
}: {
  model: "project" | "quote" | "client";
  resId: number;
  title?: string;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const query = useQuery({
    queryKey: ["chatter", model, resId],
    queryFn: () => chatterService.messages(model, resId),
    enabled: Number.isFinite(resId) && resId > 0,
  });

  const post = useMutation({
    mutationFn: () => chatterService.post({ model, res_id: resId, body }),
    onSuccess: (data) => {
      queryClient.setQueryData(["chatter", model, resId], data);
      setBody("");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "No se pudo guardar la nota"),
  });

  const rows = query.data?.rows ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="size-4 text-muted-foreground" />
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
      </div>

      <div className="flex flex-col gap-2">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Escribe una nota para el equipo…"
          rows={3}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => post.mutate()}
            disabled={!body.trim() || post.isPending}
          >
            {post.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Guardar nota
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          Todavía no hay notas en este registro.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((message) => (
            <li key={message.id} className="flex gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                {initials(message.author)}
              </span>
              <div className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">{message.author}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDateTime(message.date)}</p>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-foreground">{message.body}</p>
                {message.tracking.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
                    {message.tracking.map((change, index) => (
                      <li
                        key={`${message.id}-${index}`}
                        className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                      >
                        <History className="size-3" />
                        <span className="font-medium text-foreground">{change.field}:</span>
                        <span className="line-through">{change.old_value}</span>
                        <span>→</span>
                        <span className="font-medium text-foreground">{change.new_value}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
