import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/shared/lib/toast/toast';
import { useAuthStore } from '@/shared/store/auth.store';
import { TEXTS } from '@/shared/config/texts';

/**
 * Firebase SDK를 로그인 상태에서만 동적 import하는 이유: 비로그인 방문자는 FCM 토큰을
 * 등록할 일이 없어 foreground 리스너가 애초에 필요 없는데, 예전에는 방문자 전원이
 * 초기 번들에서 Firebase 전체를 받고 있었다(실측: 2026-09-26 빌드에서 vendor 청크에
 * 포함, docs/plans/2026-09-25-lighthouse-perf.md 참고).
 */
export function useFcmForegroundMessage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    async function subscribe() {
      const [{ onMessage }, { messaging }] = await Promise.all([
        import('firebase/messaging'),
        import('@/shared/lib/firebase/firebase'),
      ]);

      if (!messaging || cancelled) {
        return;
      }

      unsubscribe = onMessage(messaging, (payload) => {
        const title = payload.notification?.title ?? TEXTS.notification.defaultTitle;
        const body = payload.notification?.body ?? '';
        const postId = payload.data?.postId;

        toast(title, {
          description: body,
          ...(postId && {
            action: {
              label: TEXTS.notification.viewAction,
              onClick: () => navigate(`/post/${postId}`),
            },
            closeButton: false,
          }),
        });
      });
    }

    subscribe();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [navigate, isAuthenticated]);
}
