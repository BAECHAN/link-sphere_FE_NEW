import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/shared/store/auth.store';
import { useLoginDialogStore } from '@/shared/store/loginDialog.store';
import { useHistoryOverlay } from '@/shared/hooks/useHistoryOverlay';

/**
 * 보호 페이지로의 이동 가드.
 * 로그인 상태면 바로 이동하고, 비로그인이면 로그인 모달을 띄운 뒤
 * 로그인 성공 시 원래 가려던 페이지로 이동한다.
 * `replace`를 주면 지금 엔트리를 남기지 않는다 - 모바일 메뉴처럼 오버레이 엔트리에서 떠날 때 쓴다.
 */
export function useProtectedNavigate() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setLoginOnSuccess = useLoginDialogStore((state) => state.setOnSuccess);
  const { open: openLoginDialog, openReplacingCurrent: openLoginDialogReplacingCurrent } =
    useHistoryOverlay('loginDialogOpen');
  const navigate = useNavigate();

  return useCallback(
    (to: string, options?: { replace?: boolean }) => {
      if (isAuthenticated) {
        navigate(to, options);
        return;
      }
      // ProtectedRoute.tsx의 리다이렉트와 동일하게 replace를 쓴다 - push하면 로그인모달이 열려있던
      // 엔트리 위에 쌓여, 그 엔트리가 히스토리에 orphan으로 남는다(뒤로가기 시 모달 재등장)
      setLoginOnSuccess(() => navigate(to, { replace: true }));

      if (options?.replace) {
        openLoginDialogReplacingCurrent();
        return;
      }

      openLoginDialog();
    },
    [isAuthenticated, setLoginOnSuccess, openLoginDialog, openLoginDialogReplacingCurrent, navigate]
  );
}
