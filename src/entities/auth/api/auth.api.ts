import { apiClient } from '@/shared/api/client';
import {
  Login,
  LoginResponse,
  CreateAccount,
  PasswordResetRequest,
  PasswordResetConfirm,
  ChangePassword,
} from '@/entities/auth/model/auth.schema';
import { Account } from '@/entities/account/@x/auth';
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
    // confirmPassword는 클라이언트에서 일치 여부만 확인하는 필드라 서버로 보내지 않는다.
    const response = await apiClient.post<Account>(API_ENDPOINTS.auth.signup, {
      nickname: payload.nickname,
      email: payload.email,
      password: payload.password,
    });
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

  /** 계정 존재 여부와 무관하게 항상 같은 방식으로 끝난다(서버가 200을 고정 반환). */
  requestPasswordReset: async (payload: PasswordResetRequest): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.auth.passwordResetRequest, {
      email: payload.email,
    });
  },

  confirmPasswordReset: async (payload: PasswordResetConfirm): Promise<void> => {
    // confirmPassword는 클라이언트 전용 확인 필드라 서버로 보내지 않는다.
    await apiClient.post(API_ENDPOINTS.auth.passwordResetConfirm, {
      token: payload.token,
      newPassword: payload.newPassword,
    });
  },

  /**
   * 비밀번호 변경 성공 시 BE가 이 기기를 제외한 모든 세션을 폐기하고 새 세션을 발급한다
   * (docs/plans/2026-09-28-auth-hardening.md Phase 5) - 응답의 accessToken으로 즉시
   * 갱신하지 않으면 이전 토큰이 무효화돼 바로 다음 요청부터 401이 난다.
   */
  changePassword: async (payload: ChangePassword): Promise<LoginResponse> => {
    // confirmPassword는 클라이언트 전용 확인 필드라 서버로 보내지 않는다.
    const response = await apiClient.patch<LoginResponse>(API_ENDPOINTS.auth.changePassword, {
      currentPassword: payload.currentPassword,
      newPassword: payload.newPassword,
    });
    return response;
  },
};
