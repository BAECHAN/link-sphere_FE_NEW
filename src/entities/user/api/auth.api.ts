import { apiClient } from '@/shared/api/client';
import {
  Login,
  LoginResponse,
  Account,
  CreateAccount,
  UpdateAccount,
  AvatarUploadResponse,
  avatarUploadResponseSchema,
} from '@/shared/types/auth.type';
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

  updateAccount: async (payload: UpdateAccount): Promise<Account> => {
    const response = await apiClient.patch<Account>(API_ENDPOINTS.auth.updateAccount, payload);
    return response;
  },

  uploadAvatar: async (file: File): Promise<AvatarUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<AvatarUploadResponse>(
      API_ENDPOINTS.auth.uploadAvatar,
      formData
    );
    // 일부 인앱 브라우저(예: 네이버 인앱)는 multipart 업로드를 정상 전송하지 못해
    // imageUrl 없는 비정상 응답이 200으로 내려온다. 이 경우 실패로 처리해
    // image=undefined가 저장되는 것을 막고 업로드 실패 토스트가 뜨도록 한다.
    return avatarUploadResponseSchema.parse(response);
  },
};
