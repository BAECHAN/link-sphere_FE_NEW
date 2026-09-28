import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/atoms/dialog';
import { LoginForm } from '@/features/auth/login/ui/LoginForm';
import { useLoginModal } from '@/widgets/layout/login-modal/hooks/useLoginModal';
import { TEXTS } from '@/shared/config/texts';

/**
 * 전역 로그인 유도 모달.
 * 비로그인 사용자가 인증이 필요한 액션/페이지에 접근할 때 뜬다.
 * App 최상위에 한 번만 렌더하고, 콜백은 loginModal.store가, 열림 상태는 히스토리 엔트리가 관리한다.
 */
export function LoginModal() {
  const { isOpen, handleOpenChange } = useLoginModal();

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
