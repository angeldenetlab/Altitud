"use client";

import { cn } from "@/lib/utils";
import { brand } from "@/lib/nav";

/**
 * Marca genérica de la demo: dos alturas ascendentes sobre una línea de base.
 *
 * No corresponde a ninguna identidad del cliente; es un placeholder neutro.
 * Para poner el logo real basta copiar el archivo a `public/brand/` y definir
 * `NEXT_PUBLIC_BRAND_MARK` (ej. `/brand/logo-cliente.png`) — sin tocar código.
 */
const CUSTOM_MARK = process.env.NEXT_PUBLIC_BRAND_MARK;

function AltitudeMark({ size }: { size: number }) {
  if (CUSTOM_MARK) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={CUSTOM_MARK}
        alt=""
        width={size}
        height={size}
        className="object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role="img"
      aria-hidden
      style={{ width: size, height: size }}
      className="shrink-0"
    >
      <defs>
        <linearGradient id="alt-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1f8a86" />
          <stop offset="100%" stopColor="#0d4f56" />
        </linearGradient>
      </defs>
      <rect x="36" y="36" width="440" height="440" rx="104" fill="url(#alt-tile)" />
      <path
        d="M148 330 L214 214 L262 296"
        fill="none"
        stroke="#ffffff"
        strokeWidth="42"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M262 296 L322 186 L392 330"
        fill="none"
        stroke="#f4a259"
        strokeWidth="42"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M136 386 H392"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.5"
        strokeWidth="24"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandLogo({
  compact = false,
  inverse = false,
  size = "md",
  className,
}: {
  compact?: boolean;
  inverse?: boolean;
  size?: "md" | "lg";
  className?: string;
}) {
  const markPx = compact ? 32 : size === "lg" ? 46 : 36;
  const titleClass = size === "lg" ? "text-[17px]" : "text-[14px]";
  const tagClass =
    size === "lg" ? "mt-1.5 text-[10px] tracking-[0.18em]" : "mt-1 text-[9px] tracking-[0.18em]";

  if (compact) {
    return (
      <div
        className={cn("relative flex size-9 shrink-0 items-center justify-center", className)}
        aria-label={brand.name}
      >
        <AltitudeMark size={markPx} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center select-none",
        size === "lg" ? "gap-3" : "gap-2.5",
        className,
      )}
      aria-label={brand.name}
    >
      <span
        className="relative flex shrink-0 items-center justify-center"
        style={{ width: markPx, height: markPx }}
      >
        <AltitudeMark size={markPx} />
      </span>
      <span className="flex min-w-0 flex-col justify-center leading-none">
        <span
          className={cn(
            "font-heading font-extrabold tracking-tight",
            titleClass,
            inverse ? "text-white" : "text-[#0d4f56]",
          )}
        >
          {brand.name}
        </span>
        <span
          className={cn(
            "font-semibold uppercase",
            tagClass,
            inverse ? "text-white/60" : "text-slate-500",
          )}
        >
          {brand.tagline}
        </span>
      </span>
    </div>
  );
}
