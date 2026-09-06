import { useCallback } from 'react';
import { useAuthStore } from '@/shared/store/auth.store';
import { useLoginModalStore } from '@/shared/store/loginModal.store';
import { useHistoryOverlay } from '@/shared/hooks/useHistoryOverlay';

/**
 * 인증 가드 훅.
 * 비로그인 사용자가 인증이 필요한 액션(좋아요/북마크/댓글 등)을 시도하면
 * 로그인 모달을 띄우고, 로그인 상태면 전달받은 action을 그대로 실행한다.
 * (mutation 액션은 로그인 후 자동 실행하지 않는다 — 로그인만 유도)
 */
export function useAuthGuard() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setLoginOnSuccess = useLoginModalStore((state) => state.setOnSuccess);
  const { open: openLoginModal } = useHistoryOverlay('loginModalOpen');

  return useCallback(
    (action: () => void) => {
      if (isAuthenticated) {
        action();
        return;
      }
      // 이전에 열렸을 때의 콜백이 남아 있지 않도록 비운다 - 이 가드는 로그인만 유도한다
      setLoginOnSuccess(undefined);
      openLoginModal();
    },
    [isAuthenticated, setLoginOnSuccess, openLoginModal]
  );
}
