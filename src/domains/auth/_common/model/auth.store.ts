import { create } from 'zustand';
import { Member } from '@/domains/member/_common/model/member.schema';

interface AuthState {
  accessToken: string | null;
  user: Member | null;
  isAuthenticated: boolean;
  setAuth: (accessToken: string | null, user?: Member | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  setAuth: (accessToken, user = null) =>
    set({
      accessToken,
      user,
      isAuthenticated: !!accessToken,
    }),
  clearAuth: () =>
    set({
      accessToken: null,
      user: null,
      isAuthenticated: false,
    }),
}));
