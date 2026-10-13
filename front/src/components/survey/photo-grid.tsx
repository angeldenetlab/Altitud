"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePhotoAction, uploadPhotoAction } from "@/app/levantamientos/actions";
import { Button } from "@/components/ui/button";
import { shrinkPhoto } from "@/lib/image";
import type { Photo } from "@/types/survey";

/**
 * Evidencia del sitio. Se sube una por una: en campo la señal se cae y así
 * solo se reintenta la que falló, no el lote.
 */
export function PhotoGrid({
  surveyId,
  photos,
  editable,
}: {
  surveyId: number;
  photos: Photo[];
  editable: boolean;
}) {
  const [uploading, setUploading] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    setUploading((count) => count + files.length);
    let failed = 0;

    for (const file of files) {
      try {
        const prepared = await shrinkPhoto(file);
        const formData = new FormData();
        formData.set("surveyId", String(surveyId));
        formData.set("photo", prepared);
        const result = await uploadPhotoAction(formData);
        if (!result.ok) {
          failed += 1;
          toast.error(result.error ?? "No se pudo subir la foto.");
        }
      } catch {
        failed += 1;
        toast.error("No se pudo subir la foto. Revisa tu conexión.");
      } finally {
        setUploading((count) => count - 1);
      }
    }

    if (failed < files.length) {
      toast.success(files.length - failed === 1 ? "Foto guardada." : "Fotos guardadas.");
      router.refresh();
    }
  }

  function remove(photo: Photo) {
    if (!window.confirm("¿Quitar esta foto del levantamiento?")) return;
    startTransition(async () => {
      const result = await deletePhotoAction(surveyId, photo.id);
      if (result.ok) {
        router.refresh();
      } else {
        toast.error(result.error ?? "No se pudo quitar la foto.");
      }
    });
  }

  return (
    <div className="grid gap-3">
      {photos.length === 0 && uploading === 0 && (
        <p className="rounded-xl bg-muted px-3.5 py-3 text-sm text-muted-foreground">
          Sin fotos. Son la evidencia del sitio, no de la ejecución.
        </p>
      )}

      {(photos.length > 0 || uploading > 0) && (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <li key={photo.id} className="relative">
              <a
                href={`/api/fotos/${photo.id}`}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-xl bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/fotos/${photo.id}`}
                  alt={photo.name}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              </a>
              {editable && (
                <button
                  type="button"
                  onClick={() => remove(photo)}
                  disabled={pending}
                  aria-label={`Quitar ${photo.name}`}
                  className="absolute top-1 right-1 flex size-8 items-center justify-center rounded-full bg-background/90 text-destructive shadow-sm active:bg-background"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
          {Array.from({ length: uploading }).map((_, index) => (
            <li
              key={`subiendo-${index}`}
              className="flex aspect-square items-center justify-center rounded-xl bg-muted"
            >
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <>
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={upload}
            className="hidden"
          />
          <input
            ref={galleryInput}
            type="file"
            accept="image/*"
            multiple
            onChange={upload}
            className="hidden"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => cameraInput.current?.click()}>
              <Camera className="size-5" />
              Tomar foto
            </Button>
            <Button type="button" variant="outline" onClick={() => galleryInput.current?.click()}>
              <ImagePlus className="size-5" />
              De la galería
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
