import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

// 중복 초기화 방지
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// getMessaging은 브라우저 환경에서만 동작. Firebase 설정값이 비었거나 잘못되면
// Installations API가 동기적으로 throw해 앱 전체 렌더가 죽으므로(#143 PR 본문 참고),
// FCM 기능만 비활성화되도록 감싼다 — 호출부(fcm.ts, useFcmForegroundMessage.ts)는
// 이미 messaging이 null이면 그대로 return하는 방어 로직을 갖고 있다.
let messaging: Messaging | null = null;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.error('[Firebase] getMessaging init failed — FCM disabled:', error);
  }
}

export { messaging };
