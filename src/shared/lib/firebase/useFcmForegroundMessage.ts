import { useEffect } from 'react';
import { onMessage } from 'firebase/messaging';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { messaging } from '@/shared/lib/firebase/firebase';
import { TEXTS } from '@/shared/config/texts';

export function useFcmForegroundMessage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
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

    return unsubscribe;
  }, [navigate]);
}
