import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/shared/lib/toast/toast';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

/**
 * 비공개·삭제 글(404)은 서버 장애가 아니라 접근 불가 상태다.
 * 안내 토스트 후 목록으로 돌려보낸다.
 */
export function usePostNotFoundRedirect(isNotFound: boolean) {
  const navigate = useNavigate();

  useEffect(
    function redirectWhenPostUnavailable() {
      if (!isNotFound) {
        return;
      }
      toast.error(TEXTS.post.detail.notFound, { id: 'post-detail-not-found' });
      navigate(ROUTES_PATHS.POST.ROOT, { replace: true });
    },
    [isNotFound, navigate]
  );
}
