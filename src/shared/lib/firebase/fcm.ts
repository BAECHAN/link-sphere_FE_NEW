import { useAuthStore } from '@/shared/store/auth.store';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { fcmApi } from '@/shared/api/fcm.api';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

/**
 * 서비스 워커(public/firebase-messaging-sw.js)는 import.meta.env를 읽지 못해, 예전엔 Firebase
 * 설정을 그 파일에 평문으로 적어 공개 레포에 커밋했다. 빌드 때 주입된 값을 등록 URL의
 * 쿼리로 넘기고 서비스 워커가 self.location에서 읽게 해, 설정값이 레포에 남지 않게 한다
 * (2026-10-03, #301 노출 수습).
 */
function buildServiceWorkerUrl(): string {
  const params = new URLSearchParams({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  });

  return `/firebase-messaging-sw.js?${params.toString()}`;
}

/**
 * 브라우저 알림 권한을 요청하고 FCM 토큰을 서버에 등록합니다.
 * 로그인 성공 직후 호출하세요.
 *
 * Firebase SDK를 여기서 동적 import하는 이유: 이 함수는 로그인에 성공했을 때만
 * 호출된다 - 정적으로 import하면 비로그인 방문자도 초기 번들에서 Firebase 전체를
 * 받게 된다(실측: 2026-09-26 빌드에서 vendor 청크에 포함돼 있었다,
 * docs/plans/2026-09-25-lighthouse-perf.md 참고).
 */
export async function requestAndRegisterFcmToken(): Promise<void> {
  if (!VAPID_KEY) {
    console.warn('[FCM] VITE_FIREBASE_VAPID_KEY is not set');
    return;
  }

  const [{ getToken }, { messaging }] = await Promise.all([
    import('firebase/messaging'),
    import('@/shared/lib/firebase/firebase'),
  ]);

  if (!messaging) {
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.info('[FCM] Notification permission denied');
      return;
    }

    // 서비스 워커를 처음 설치(또는 등록 URL이 바뀌어 새로 설치)하는 순간엔 아직 활성 워커가
    // 없어 구독이 "no active Service Worker"로 실패한다 - 활성화될 때까지 기다린 등록을 쓴다.
    await navigator.serviceWorker.register(buildServiceWorkerUrl());
    const serviceWorkerRegistration = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration,
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
  const [{ deleteToken }, { messaging }] = await Promise.all([
    import('firebase/messaging'),
    import('@/shared/lib/firebase/firebase'),
  ]);

  if (!messaging) {
    return;
  }

  try {
    const deleted = await deleteToken(messaging);
    if (deleted) {
      const storedToken = sessionStorage.getItem(STORAGE_KEYS.FCM.TOKEN);
      if (storedToken) {
        await deleteTokenFromServer(storedToken);
        sessionStorage.removeItem(STORAGE_KEYS.FCM.TOKEN);
      }
    }
  } catch (error) {
    console.error('[FCM] Error unregistering FCM token:', error);
  }
}

async function registerTokenToServer(token: string): Promise<void> {
  // 로그인 성공·비밀번호 변경 성공·세션 복원 성공마다 항상 서버에 재등록한다 - BE가 이
  // 요청의 access 토큰에서 세션 회전 계열(familyId)을 읽어 fcm_tokens에 함께 저장하고,
  // 그 계열이 나중에 죽으면(로그아웃 등) 이 토큰도 자동으로 발송 대상에서 빠진다
  // (docs/FCM-PUSH-NOTIFICATION.md 참고). 이전에는 같은 토큰 문자열이면 재등록을
  // 건너뛰었지만, 그러면 세션이 바뀌어도(비밀번호 변경 등) familyId가 갱신되지 않아
  // 옛 계열에 묶인 채로 다음 발송 때 끊겨버린다.
  const accessToken = getAccessTokenFromStore();
  if (!accessToken) {
    return;
  }

  await fcmApi.registerToken(token);
  sessionStorage.setItem(STORAGE_KEYS.FCM.TOKEN, token);
  console.info('[FCM] Token registered to server');
}

async function deleteTokenFromServer(token: string): Promise<void> {
  const accessToken = getAccessTokenFromStore();
  if (!accessToken) {
    return;
  }

  await fcmApi.unregisterToken(token);
}

/** Zustand auth store에서 accessToken을 꺼내옵니다. (React 컴포넌트 외부에서 getState() 사용) */
function getAccessTokenFromStore(): string | null {
  return useAuthStore.getState().accessToken ?? null;
}
