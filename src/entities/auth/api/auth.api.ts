import { apiClient } from '@/shared/api/client';
import { Login, LoginResponse, CreateAccount } from '@/entities/auth/model/auth.schema';
import { Account } from '@/entities/account/model/account.schema';
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

  createAccount: async (payload: CreateAccount): Promise<Account> => {
    const response = await apiClient.post<Account>(API_ENDPOINTS.auth.signup, payload);
    return response;
  },

  /** 이메일 가용성 사전 조회. 가입 화면(비로그인) 전용 - fail-open 여부는 호출부에서 결정한다. */
  checkEmailAvailability: async (email: string): Promise<boolean> => {
    const response = await apiClient.get<{ available: boolean }>(
      API_ENDPOINTS.auth.emailAvailability,
      { searchParams: { email } }
    );
    return response.available;
  },
};
