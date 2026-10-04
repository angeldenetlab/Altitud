import { create } from "zustand";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import type { AuthUser } from "@/types/roles";

interface MeResponse {
  authenticated: boolean;
  user?: AuthUser;
}

interface LoginResponse {
  user: AuthUser;
}

interface AuthState {
  status: "idle" | "loading" | "authenticated" | "anonymous";
  session: AuthUser | null;
  error: string | null;
  hydrate: () => Promise<void>;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "idle",
  session: null,
  error: null,

  hydrate: async () => {
    set({ status: "loading" });
    try {
      const data = await apiGet<MeResponse>("/api/auth/me");
      if (data.authenticated && data.user) {
        set({ status: "authenticated", session: data.user, error: null });
      } else {
        set({ status: "anonymous", session: null });
      }
    } catch {
      set({ status: "anonymous", session: null });
    }
  },

  login: async (login: string, password: string) => {
    set({ status: "loading", error: null });
    try {
      const data = await apiPost<LoginResponse>("/api/auth/login", {
        login,
        password,
      });
      set({ status: "authenticated", session: data.user, error: null });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "No se pudo iniciar sesión. Intenta de nuevo.";
      set({ status: "anonymous", session: null, error: message });
      throw err;
    }
  },

  logout: async () => {
    try {
      await apiPost<{ ok: boolean }>("/api/auth/logout");
    } catch {
      // clear local state even if the network call fails
    }
    set({ status: "anonymous", session: null, error: null });
  },
}));
