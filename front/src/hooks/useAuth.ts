import { useAuthStore } from "@/store/authStore";

export function useAuth() {
  const status = useAuthStore((s) => s.status);
  const session = useAuthStore((s) => s.session);
  const error = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const hydrate = useAuthStore((s) => s.hydrate);

  return {
    status,
    session,
    error,
    login,
    logout,
    hydrate,
    isAuthenticated: status === "authenticated",
    isLoading: status === "idle" || status === "loading",
  };
}
