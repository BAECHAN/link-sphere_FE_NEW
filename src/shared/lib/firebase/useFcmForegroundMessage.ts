import { useEffect } from 'react';
import { onMessage } from 'firebase/messaging';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { messaging } from '@/shared/lib/firebase/firebase';

export function useFcmForegroundMessage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      const title = payload.notification?.title ?? '새로운 알림';
      const body = payload.notification?.body ?? '';
      const postId = payload.data?.postId;

      toast(title, {
        description: body,
        ...(postId && {
          action: {
            label: '보러가기',
            onClick: () => navigate(`/post/${postId}`),
          },
          closeButton: false,
        }),
      });
    });

    return unsubscribe;
  }, [navigate]);
}
