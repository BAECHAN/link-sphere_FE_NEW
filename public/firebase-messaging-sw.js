// Firebase Messaging Service Worker
// 브라우저가 닫혀 있거나 백그라운드 상태일 때 FCM 메시지를 수신해 시스템 알림을 표시합니다.
//
// ⚠️ Firebase 프로젝트 설정 후 아래 값을 채워주세요.
// Firebase Console > Project Settings > General > Your apps > SDK setup and configuration
// (Firebase config는 공개 값이므로 여기서 직접 사용해도 안전합니다)

importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyA5ZYHnaSrXBoDKLdWY4ywThH6JLtAdl8Y',
  authDomain: 'link-sphere-e8171.firebaseapp.com',
  projectId: 'link-sphere-e8171',
  storageBucket: 'link-sphere-e8171.firebasestorage.app',
  messagingSenderId: '454216396347',
  appId: '1:454216396347:web:e6d650147c9bcabbfcb61e',
  measurementId: 'G-PZ0KK732TL',
});

const messaging = firebase.messaging();

// 백그라운드 메시지 수신 → 시스템 알림 표시
messaging.onBackgroundMessage((payload) => {
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

// 알림 클릭 시 해당 포스트 페이지로 이동
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data ?? {};
  const postId = data.postId;
  const targetUrl = postId ? `${self.location.origin}/post/${postId}` : self.location.origin;

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
