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
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

/**
 * 전역 로그인 유도 모달.
 * 비로그인 사용자가 인증이 필요한 액션/페이지에 접근할 때 뜬다.
 * App 최상위에 한 번만 렌더하고, 상태는 loginModal.store가 관리한다.
 */
export function LoginModal() {
  const { isOpen, onSuccess, close } = useLoginModalStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { pathname } = useLocation();

  // 로그인 성공 → onSuccess(원래 가려던 페이지 이동 등) 실행 후 닫기
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      onSuccess?.();
      close();
    }
  }, [isOpen, isAuthenticated, onSuccess, close]);

  // 회원가입 등 auth 페이지로 이동 시 모달 닫기 (onSuccess는 실행하지 않음)
  useEffect(() => {
    if (isOpen && (pathname === ROUTES_PATHS.AUTH.LOGIN || pathname === ROUTES_PATHS.AUTH.SIGNUP)) {
      close();
    }
  }, [isOpen, pathname, close]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
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
