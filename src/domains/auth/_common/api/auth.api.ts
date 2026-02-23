import { apiClient } from '@/shared/api/client';
import {
  Login,
  LoginResponse,
  Account,
  CreateAccount,
} from '@/domains/auth/_common/model/auth.schema';
import { API_ENDPOINTS } from '@/shared/config/api';

export const authApi = {
  /**
   * Backend Auth API로 로그인 요청
   */
  login: async (payload: Login): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>(API_ENDPOINTS.auth.login, {
      email: payload.email,
      password: payload.password,
    });

    // Refresh Token은 벡엔드에서 쿠키로 설정하므로 클라이언트 저장 불필요
    return response;
  },

  /**
   * 로그아웃 요청
   */
  logout: async (): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.auth.logout, {});
  },

  /**
   * 쿠키의 refreshToken을 사용하여 토큰 갱신
   */
  refresh: async (): Promise<LoginResponse> => {
    // refreshToken은 쿠키에 있으므로 별도 전송 불필요
    const response = await apiClient.post<LoginResponse>(API_ENDPOINTS.auth.refresh);

    return response;
  },

  fetchAccount: async (): Promise<Account> => {
    const response = await apiClient.get<Account>(API_ENDPOINTS.auth.account);
    return response;
  },

  createAccount: async (payload: CreateAccount): Promise<Account> => {
    const response = await apiClient.post<Account>(API_ENDPOINTS.auth.signup, payload);
    return response;
  },
};
