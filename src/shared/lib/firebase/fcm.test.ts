import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { getToken } from 'firebase/messaging';
import { fcmApi } from '@/shared/api/fcm.api';
import { useAuthStore } from '@/shared/store/auth.store';
import { requestAndRegisterFcmToken, reregisterFcmTokenIfGranted } from '@/shared/lib/firebase/fcm';

// VAPID 키는 fcm.ts가 모듈을 불러올 때 한 번 읽으므로 import보다 먼저 넣는다(.env 유무와 상관없이 같은 값으로 테스트한다).
vi.hoisted(() => {
  vi.stubEnv('VITE_FIREBASE_VAPID_KEY', 'test-vapid-key');
});

vi.mock('firebase/messaging', () => ({
  getToken: vi.fn(),
  deleteToken: vi.fn(),
}));

vi.mock('@/shared/lib/firebase/firebase', () => ({
  messaging: {},
}));

vi.mock('@/shared/api/fcm.api', () => ({
  fcmApi: {
    registerToken: vi.fn(),
  },
}));

// jsdom에는 Notification이 없다 - 테스트마다 권한 상태를 정해 넣는다.
function stubNotification(permission: NotificationPermission, requested = permission) {
  const requestPermission = vi.fn().mockResolvedValue(requested);
  vi.stubGlobal('Notification', { permission, requestPermission });

  return requestPermission;
}

describe('fcm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getToken).mockResolvedValue('fcm-token');
    vi.mocked(fcmApi.registerToken).mockResolvedValue(undefined);
    // jsdom에는 serviceWorker도 없다.
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register: vi.fn().mockResolvedValue({}), ready: Promise.resolve({}) },
    });
    useAuthStore.getState().setAuth('access-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.getState().clearAuth();
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  describe('reregisterFcmTokenIfGranted', () => {
    it('아직 권한을 정하지 않았으면 묻지 않고, 등록 흐름에 들어가지 않고 조용히 끝낸다', async () => {
      const requestPermission = stubNotification('default');
      // 등록 흐름에 들어갔다면 Firebase SDK를 불러온 뒤 "권한 거부" 로그를 남긴다.
      const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});

      await reregisterFcmTokenIfGranted();

      expect(requestPermission).not.toHaveBeenCalled();
      expect(getToken).not.toHaveBeenCalled();
      expect(fcmApi.registerToken).not.toHaveBeenCalled();
      expect(consoleInfo).not.toHaveBeenCalled();
      consoleInfo.mockRestore();
    });

    it('거부했으면 묻지 않고 등록도 하지 않는다', async () => {
      const requestPermission = stubNotification('denied');

      await reregisterFcmTokenIfGranted();

      expect(requestPermission).not.toHaveBeenCalled();
      expect(fcmApi.registerToken).not.toHaveBeenCalled();
    });

    it('이미 허용했으면 묻지 않고 토큰을 서버에 다시 등록한다', async () => {
      const requestPermission = stubNotification('granted');

      await reregisterFcmTokenIfGranted();

      expect(requestPermission).not.toHaveBeenCalled();
      expect(fcmApi.registerToken).toHaveBeenCalledWith('fcm-token');
    });

    it('Notification이 없는 브라우저면 에러 없이 아무것도 하지 않는다', async () => {
      // 등록 흐름에 들어갔다면 Notification 참조가 ReferenceError로 잡혀 에러 로그가 남는다.
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await reregisterFcmTokenIfGranted();

      expect(getToken).not.toHaveBeenCalled();
      expect(fcmApi.registerToken).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('requestAndRegisterFcmToken', () => {
    it('로그인 경로는 여전히 권한을 묻고, 허용하면 토큰을 등록한다', async () => {
      const requestPermission = stubNotification('default', 'granted');

      await requestAndRegisterFcmToken();

      expect(requestPermission).toHaveBeenCalledTimes(1);
      expect(fcmApi.registerToken).toHaveBeenCalledWith('fcm-token');
    });
  });
});
