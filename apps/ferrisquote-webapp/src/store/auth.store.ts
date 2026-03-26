import { create } from "zustand"
import { persist } from "zustand/middleware"

type AuthStore = {
  accessToken: string | null
  setAccessToken: (token: string | null) => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      accessToken: null,
      setAccessToken: (token) => set({ accessToken: token }),
    }),
    { name: "auth-store" },
  ),
)
