"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status === "idle") {
      void hydrate();
    }
  }, [status, hydrate]);

  return <>{children}</>;
}
