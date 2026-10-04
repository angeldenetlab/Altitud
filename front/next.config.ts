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

// El navegador nunca habla con el ERP: todo pasa por los Route Handlers de
// /api/erp/* (patrón BFF). Ver docs/INTEGRACION-ODOO.md.
const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: parseAllowedDevOrigins(process.env.ALLOWED_DEV_ORIGINS),
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
