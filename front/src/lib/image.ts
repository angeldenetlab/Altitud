/**
 * Prepara la foto antes de subirla.
 *
 * Una foto de celular pesa de 3 a 8 MB y en el sitio la señal es mala. Se
 * reduce a 1600 px de lado mayor en el propio teléfono: alcanza de sobra para
 * ver fachada, accesos y estado, y sube en segundos. Si el navegador no puede
 * decodificarla (HEIC en escritorio, por ejemplo), se manda tal cual.
 */

const MAX_SIDE = 1600;
const QUALITY = 0.82;

export async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    // `from-image` respeta el EXIF: sin eso, las fotos verticales salen giradas.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));

    if (scale === 1 && file.size <= 1_200_000) {
      bitmap.close();
      return file;
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || `foto-${Date.now()}`;
    return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
