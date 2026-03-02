import { getToken } from 'firebase/messaging';
import { useAuthStore } from '@/shared/store/auth.store';
import { messaging } from '@/shared/lib/firebase/firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

/**
 * 브라우저 알림 권한을 요청하고 FCM 토큰을 서버에 등록합니다.
 * 로그인 성공 직후 호출하세요.
 */
export async function requestAndRegisterFcmToken(): Promise<void> {
  if (!messaging) return;
  if (!VAPID_KEY) {
    console.warn('[FCM] VITE_FIREBASE_VAPID_KEY is not set');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.info('[FCM] Notification permission denied');
      return;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.register(
        '/firebase-messaging-sw.js'
      ),
    });

    if (!token) {
      console.warn('[FCM] Failed to get FCM token');
      return;
    }

    await registerTokenToServer(token);
  } catch (error) {
    console.error('[FCM] Error requesting FCM token:', error);
  }
}

/**
 * 로그아웃 시 서버에서 FCM 토큰을 삭제합니다.
 */
export async function unregisterFcmToken(): Promise<void> {
  if (!messaging) return;

  try {
    const { deleteToken } = await import('firebase/messaging');
    const deleted = await deleteToken(messaging);
    if (deleted) {
      const storedToken = sessionStorage.getItem('fcmToken');
      if (storedToken) {
        await deleteTokenFromServer(storedToken);
        sessionStorage.removeItem('fcmToken');
      }
    }
  } catch (error) {
    console.error('[FCM] Error unregistering FCM token:', error);
  }
}

async function registerTokenToServer(token: string): Promise<void> {
  // 동일 토큰을 중복 등록하지 않도록 세션에 캐싱
  if (sessionStorage.getItem('fcmToken') === token) return;

  const baseUrl = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_BASE_URL as string);

  const accessToken = getAccessTokenFromStore();
  if (!accessToken) return;

  const res = await fetch(`${baseUrl}/fcm/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ token, platform: 'WEB' }),
  });

  if (res.ok) {
    sessionStorage.setItem('fcmToken', token);
    console.info('[FCM] Token registered to server');
  }
}

async function deleteTokenFromServer(token: string): Promise<void> {
  const baseUrl = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_BASE_URL as string);

  const accessToken = getAccessTokenFromStore();
  if (!accessToken) return;

  await fetch(`${baseUrl}/fcm/token`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ token }),
  });
}

/** Zustand auth store에서 accessToken을 꺼내옵니다. (React 컴포넌트 외부에서 getState() 사용) */
function getAccessTokenFromStore(): string | null {
  return useAuthStore.getState().accessToken ?? null;
}
