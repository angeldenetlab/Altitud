import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPhotoBytes } from "@/server/surveys";

/**
 * Sirve la foto del levantamiento.
 *
 * Los adjuntos de Odoo no son públicos y el portal no abre sesión de Odoo en
 * el teléfono: las bajamos con la cuenta técnica y las pasamos a quien tenga
 * sesión del portal. Solo adjuntos de `altitud.survey`.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  }

  const { id } = await params;
  const attachmentId = Number(id);
  if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
    return NextResponse.json({ error: "Foto inválida." }, { status: 400 });
  }

  const photo = await getPhotoBytes(attachmentId);
  if (!photo) {
    return NextResponse.json({ error: "Esa foto no existe." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(photo.body), {
    headers: {
      "Content-Type": photo.mimetype,
      "Content-Length": String(photo.body.byteLength),
      // El adjunto no cambia: se puede dejar en el teléfono.
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}
