import { specClient } from '@/shared/api/spec-client';

export const fcmApi = {
  /** FCM 토큰을 서버에 등록 */
  registerToken: async (token: string): Promise<void> => {
    return await specClient.post('/fcm/token', { body: { token, platform: 'WEB' } });
  },
};
