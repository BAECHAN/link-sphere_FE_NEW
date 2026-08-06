import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/atoms/dialog';
import { LoginForm } from '@/features/auth/login/ui/LoginForm';
import { useLoginModalStore } from '@/shared/store/loginModal.store';
import { useAuthStore } from '@/shared/store/auth.store';
import { useHistoryOverlay } from '@/shared/hooks/useHistoryOverlay';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

/**
 * 전역 로그인 유도 모달.
 * 비로그인 사용자가 인증이 필요한 액션/페이지에 접근할 때 뜬다.
 * App 최상위에 한 번만 렌더하고, 콜백은 loginModal.store가, 열림 상태는 히스토리 엔트리가 관리한다.
 */
export function LoginModal() {
  const { onSuccess, setOnSuccess } = useLoginModalStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { pathname } = useLocation();
  const { isOpen, close } = useHistoryOverlay('loginModalOpen');

  // 로그인 성공 → onSuccess(원래 가려던 페이지 이동 등) 실행 후 닫기
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      onSuccess?.();
      // 콜백도 함께 비운다 - 다음 open이 새 콜백을 넘기지 않으면 이전 콜백이 남아 재사용되는 것을 막는다
      setOnSuccess(undefined);
      close();
    }
  }, [isOpen, isAuthenticated, onSuccess, setOnSuccess, close]);

  // 회원가입 등 auth 페이지로 이동 시 모달 닫기 (onSuccess는 실행하지 않음)
  useEffect(() => {
    if (isOpen && (pathname === ROUTES_PATHS.AUTH.LOGIN || pathname === ROUTES_PATHS.AUTH.SIGNUP)) {
      setOnSuccess(undefined);
      close();
    }
  }, [isOpen, pathname, setOnSuccess, close]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setOnSuccess(undefined);
          close();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{TEXTS.auth.guard.title}</DialogTitle>
          <DialogDescription>{TEXTS.auth.description}</DialogDescription>
        </DialogHeader>
        <LoginForm />
      </DialogContent>
    </Dialog>
  );
}
