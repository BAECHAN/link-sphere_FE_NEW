// Firebase Messaging Service Worker
// 브라우저가 닫혀 있거나 백그라운드 상태일 때 FCM 메시지를 수신해 시스템 알림을 표시합니다.
//
// Firebase 설정은 이 파일에 적지 않는다 — 앱이 빌드 때 주입된 값(VITE_FIREBASE_*)을 등록 URL의
// 쿼리로 넘기고(src/shared/lib/firebase/fcm.ts의 buildServiceWorkerUrl), 여기서 읽는다.
// 예전엔 값을 평문으로 적어 공개 레포에 커밋했다(2026-10-03 제거, #301 노출 수습).

importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

const configParams = new URL(self.location.href).searchParams;
const firebaseConfig = {
  apiKey: configParams.get('apiKey'),
  authDomain: configParams.get('authDomain'),
  projectId: configParams.get('projectId'),
  messagingSenderId: configParams.get('messagingSenderId'),
  appId: configParams.get('appId'),
};

// 쿼리 없이 등록된 경우(설정 누락)엔 초기화하지 않는다 — 알림 클릭 처리만 남는다
const hasConfig = Object.values(firebaseConfig).every(Boolean);

if (hasConfig) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = hasConfig ? firebase.messaging() : null;

// 백그라운드 메시지 수신 → 시스템 알림 표시
messaging?.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  const data = payload.data ?? {};

  const notificationTitle = title ?? '새로운 알림';
  const notificationOptions = {
    body: body ?? '',
    icon: '/favicons/android-chrome-192x192.png',
    badge: '/favicons/favicon-32x32.png',
    data: data,
    tag: data.type ?? 'notification',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 시 해당 포스트 페이지의 그 댓글 위치로 이동
// (#comment-<id> 해시는 "내 댓글"에서 들어올 때와 같은 CommentList의 해시 스크롤·강조를 탄다)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data ?? {};
  const postId = data.postId;
  const commentHash = data.commentId ? `#comment-${data.commentId}` : '';
  const targetUrl = postId
    ? `${self.location.origin}/post/${postId}${commentHash}`
    : self.location.origin;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
