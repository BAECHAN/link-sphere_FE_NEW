import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/shared/store/auth.store';
import { useLoginModalStore } from '@/shared/store/loginModal.store';

/**
 * 보호 페이지로의 이동 가드.
 * 로그인 상태면 바로 이동하고, 비로그인이면 로그인 모달을 띄운 뒤
 * 로그인 성공 시 원래 가려던 페이지로 이동한다.
 */
export function useProtectedNavigate() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openLoginModal = useLoginModalStore((state) => state.open);
  const navigate = useNavigate();

  return useCallback(
    (to: string) => {
      if (isAuthenticated) {
        navigate(to);
        return;
      }
      openLoginModal(() => navigate(to));
    },
    [isAuthenticated, openLoginModal, navigate]
  );
}
