import { apiClient } from '@/shared/api/client';
import { LoginRequest, LoginResponse } from '@/domains/auth/_common/model/auth.schema';
import { LocalStorageUtil } from '@/shared/utils/storage.util';

interface SupabaseTokenResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    user_metadata?: {
      role?: string;
    };
  };
}

const env = import.meta.env as Record<string, string | undefined>;
const SUPABASE_URL = env.VITE_SUPABASE_URL ?? '';
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY ?? '';

export const authApi = {
  /**
   * Supabase Auth API로 로그인 요청
   */
  login: async (payload: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<SupabaseTokenResponse>(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        email: payload.email,
        password: payload.password,
      },
      {
        headers: {
          apikey: SUPABASE_KEY,
        },
      }
    );

    // Refresh Token은 로컬 스토리지에 저장
    if (response.refresh_token) {
      LocalStorageUtil.setItem('refreshToken', response.refresh_token);
    }

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      user: {
        id: response.user.id,
        email: response.user.email,
        role: (response.user.user_metadata?.role as any) || 'USER',
      },
    };
  },

  /**
   * Supabase 로그아웃 요청
   */
  logout: async (): Promise<void> => {
    await apiClient.post(
      `${SUPABASE_URL}/auth/v1/logout`,
      {},
      {
        headers: {
          apikey: SUPABASE_KEY,
        },
      }
    );
  },

  /**
   * 로컬 스토리지의 refreshToken을 사용하여 토큰 갱신
   */
  refresh: async (): Promise<LoginResponse> => {
    const refreshToken = LocalStorageUtil.getItem<string>('refreshToken');

    if (!refreshToken) throw new Error('No refresh token found');

    const response = await apiClient.post<SupabaseTokenResponse>(
      `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        refresh_token: refreshToken,
      },
      {
        headers: {
          apikey: SUPABASE_KEY,
        },
      }
    );

    // 새 리프레시 토큰 저장
    if (response.refresh_token) {
      LocalStorageUtil.setItem('refreshToken', response.refresh_token);
    }

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      user: {
        id: response.user.id,
        email: response.user.email,
        role: (response.user.user_metadata?.role as any) || 'USER',
      },
    };
  },
};
