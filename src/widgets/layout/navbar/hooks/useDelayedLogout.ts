import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/entities/auth/hooks/useAuth';
import { useAlert } from '@/shared/ui/elements/dialog/alert/alert.store';
import { clearAllUnsavedChanges, hasUnsavedChanges } from '@/shared/store/unsavedChanges.store';
import { ROUTES_PATHS, isProtectedPath } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

/**
 * 로그아웃이 처리되고 있음을 잠깐 보여준 뒤 실제 로그아웃한다 (즉시 로그인 버튼으로
 * 바뀌어 정말 로그아웃됐는지 사용자가 의심하는 것을 방지).
 *
 * 쓰는 중이면 먼저 확인한다 - 로그아웃하면 그 글을 버린다(docs/plans/2026-10-28-keep-writing-in-place.md 결정 7).
 * 확인하면 이탈 확인 등록을 비우고 로그아웃한 뒤 피드로 간다. 보호 화면은 로그아웃(clearAll)이 이미 피드로 보내고,
 * 공개 화면(글 상세의 댓글 등)은 여기서 보낸다 - 그 자리에 두면 입력칸에 버리기로 한 글이 남는다.
 */
export function useDelayedLogout() {
  const { logout } = useAuth();
  const { openConfirm } = useAlert();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logoutAfterDelay = async ({ leaveForFeed }: { leaveForFeed: boolean }) => {
    setIsLoggingOut(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    // 로그아웃 전에 읽는다 - 보호 화면이면 로그아웃이 피드로 보내는데, 그 이동은 바로 주소에 반영되지 않는다
    const shouldNavigate = leaveForFeed && !isProtectedPath(window.location.pathname);
    logout();
    setIsLoggingOut(false);

    if (shouldNavigate) {
      navigate(ROUTES_PATHS.POST.ROOT, { replace: true });
    }
  };

  const handleLogout = async () => {
    if (!hasUnsavedChanges()) {
      await logoutAfterDelay({ leaveForFeed: false });
      return;
    }

    // 강조·초기 포커스는 기본값(취소 = 계속 작성)이다 - 이탈 확인창(useUnsavedChangesGuard)과 같다
    openConfirm({
      title: TEXTS.unsavedChanges.logout.title,
      message: TEXTS.unsavedChanges.logout.message,
      confirmText: TEXTS.unsavedChanges.logout.confirm,
      cancelText: TEXTS.unsavedChanges.logout.cancel,
      onConfirm: () => {
        clearAllUnsavedChanges();
        void logoutAfterDelay({ leaveForFeed: true });
      },
    });
  };

  return { isLoggingOut, handleLogout };
}
