import { useEffect, useRef } from 'react';
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

  // 로그인 성공 → onSuccess(원래 가려던 페이지 이동 등) 실행 후 닫기.
  // onSuccess가 있으면 그 navigate가 이미 이 위치(loginModalOpen인 엔트리)를 벗어나므로
  // 모달은 자연히 닫힌다 - 여기서 close()(navigate(-1))까지 같이 부르면 onSuccess가 남긴
  // 새 엔트리 바로 뒤인 이 모달 엔트리 자신으로 되돌아가버려 모달이 안 닫히고 X·ESC·backdrop도
  // 무반응이 된다(Sidebar.tsx의 드로어 close() 제거와 동일한 이유의 레이스).
  // handledRef: setOnSuccess(undefined) 자체가 store 구독을 통해 이 effect를 한 번 더 돌게 만든다 -
  // 재실행 시점엔 onSuccess가 이미 비워진 뒤라 else 분기(close)로 잘못 빠지므로, 이 열림 주기당
  // 딱 한 번만 분기를 태우도록 막는다.
  const handledSuccessRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      handledSuccessRef.current = false;
      return;
    }
    if (isAuthenticated && !handledSuccessRef.current) {
      handledSuccessRef.current = true;
      if (onSuccess) {
        onSuccess();
        setOnSuccess(undefined);
      } else {
        setOnSuccess(undefined);
        close();
      }
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
