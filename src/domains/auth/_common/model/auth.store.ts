import { create } from 'zustand';
import { MemberRole } from '@/domains/member/_common/model/member.schema';

interface User {
  id: string;
  email: string;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  role: MemberRole | null;
  isAuthenticated: boolean;
  setAuth: (accessToken: string | null, role: MemberRole | null, user?: User | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  role: null,
  isAuthenticated: false,
  setAuth: (accessToken, role, user = null) =>
    set({
      accessToken,
      role,
      user,
      isAuthenticated: !!accessToken,
    }),
  clearAuth: () =>
    set({
      accessToken: null,
      user: null,
      role: null,
      isAuthenticated: false,
    }),
}));
