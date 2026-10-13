import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

function parseAllowedDevOrigins(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: parseAllowedDevOrigins(process.env.ALLOWED_DEV_ORIGINS),
  turbopack: {
    root: projectRoot,
  },
  experimental: {
    // Las fotos del sitio viajan por una Server Action. Se reducen en el
    // teléfono antes de subir, pero el tope de 1 MB por omisión se queda corto.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
