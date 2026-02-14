import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string | null) => void;
  setAccessToken: (token: string | null) => void; // 하위 호환성 유지
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      accessToken: null,
      isAuthenticated: false,
      setAuth: (token) => set({ accessToken: token, isAuthenticated: !!token }),
      setAccessToken: (token) => set({ accessToken: token, isAuthenticated: !!token }),
      clearAuth: () => set({ accessToken: null, isAuthenticated: false }),
    }),
    { name: 'auth-store' }
  )
);
