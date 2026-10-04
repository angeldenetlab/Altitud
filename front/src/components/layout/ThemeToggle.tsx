"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- required to avoid SSR/client theme hydration mismatch
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-border bg-muted p-0.5 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-full bg-background text-foreground shadow-sm ring-1 ring-foreground/10 transition-transform duration-300 ease-out",
          isDark ? "translate-x-6" : "translate-x-0"
        )}
      >
        {isDark ? (
          <Moon className="size-3.5 text-primary" strokeWidth={2.2} />
        ) : (
          <Sun className="size-3.5 text-accent-foreground" strokeWidth={2.2} />
        )}
      </span>
    </button>
  );
}
