import { apiClient } from '@/shared/api/client';
import { API_ENDPOINTS } from '@/shared/config/api';

export const fcmApi = {
  /** FCM 토큰을 서버에 등록 */
  registerToken: async (token: string): Promise<void> => {
    return await apiClient.post<void>(API_ENDPOINTS.fcm.token, { token, platform: 'WEB' });
  },
};
