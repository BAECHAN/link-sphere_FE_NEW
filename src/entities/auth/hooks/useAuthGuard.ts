import { useCallback } from 'react';
import { useAuthStore } from '@/shared/store/auth.store';
import { useLoginModalStore } from '@/shared/store/loginModal.store';
import { useHistoryOverlay } from '@/shared/hooks/useHistoryOverlay';

interface AuthGuardOptions {
  /**
   * true면 로그인 성공 후 모달이 닫힌 뒤 action을 자동으로 재개한다.
   * 기본값(false)은 로그인만 유도하고 action은 실행하지 않는다.
   * 서버에 쓰는 action에는 켜지 않는다 - 좋아요처럼 토글인 액션을 재개하면
   * 로그인 후 갱신된 상태를 기준으로 다시 토글돼 의도와 반대로 취소될 수 있고,
   * 댓글 작성처럼 클릭 시점 클로저에 갇힌 값(작성자 정보 등)을 참조하는 액션은
   * 재개 시점에 그 값이 비어 있어 조용히 아무 일도 안 일어날 수 있다.
   */
  resumeAfterLogin?: boolean;
}

/**
 * 인증 가드 훅.
 * 비로그인 사용자가 인증이 필요한 액션(좋아요/북마크/댓글 등)을 시도하면
 * 로그인 모달을 띄우고, 로그인 상태면 전달받은 action을 그대로 실행한다.
 * (기본값은 로그인 후 action을 자동 실행하지 않는다 — 로그인만 유도.
 * resumeAfterLogin을 켠 action만 재개하며, 서버에 쓰는 action에는 켜지 않는다.)
 */
export function useAuthGuard() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setLoginOnSuccess = useLoginModalStore((state) => state.setOnSuccess);
  const setPendingAction = useLoginModalStore((state) => state.setPendingAction);
  const { open: openLoginModal } = useHistoryOverlay('loginModalOpen');

  return useCallback(
    (action: () => void, options?: AuthGuardOptions) => {
      if (isAuthenticated) {
        action();
        return;
      }
      // 이전에 열렸을 때의 콜백이 남아 있지 않도록 비운다 - 이 가드는 navigate형
      // 채널(onSuccess)을 쓰지 않는다
      setLoginOnSuccess(undefined);
      // resumeAfterLogin이 아니면 undefined로 비운다 - 직전에 취소된 재개 액션의
      // 잔재가 다음(재개를 켜지 않은) 액션 클릭으로 되살아나는 걸 막는다
      setPendingAction(options?.resumeAfterLogin ? action : undefined);
      openLoginModal();
    },
    [isAuthenticated, setLoginOnSuccess, setPendingAction, openLoginModal]
  );
}
