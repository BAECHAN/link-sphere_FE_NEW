import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/atoms/dialog';
import { LoginForm } from '@/features/auth/login/ui/LoginForm';
import { useLoginDialog } from '@/widgets/layout/login-dialog/hooks/useLoginDialog';
import { TEXTS } from '@/shared/config/texts';

/**
 * 전역 로그인 유도 모달.
 * 비로그인 사용자가 인증이 필요한 액션/페이지에 접근할 때 뜬다.
 * App 최상위에 한 번만 렌더하고, 콜백은 loginDialog.store가, 열림 상태는 히스토리 엔트리가 관리한다.
 */
export function LoginDialog() {
  const { isOpen, reason, handleOpenChange, hasUserInput, handleInputDirtyChange } =
    useLoginDialog();
  // 로그인이 풀려 쓰던 화면에서 연 창은 왜 떴는지를 알린다(만료, 다른 탭 로그아웃). 그 밖에는 기본 문구
  const texts = reason
    ? TEXTS.auth.guard[reason]
    : { title: TEXTS.auth.guard.title, description: TEXTS.auth.description };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" dismissOnOutsideClick={!hasUserInput}>
        <DialogHeader>
          <DialogTitle>{texts.title}</DialogTitle>
          <DialogDescription>{texts.description}</DialogDescription>
        </DialogHeader>
        <LoginForm onInputDirtyChange={handleInputDirtyChange} />
      </DialogContent>
    </Dialog>
  );
}
