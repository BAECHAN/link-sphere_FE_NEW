import { useEffect, useRef } from 'react';
import { useBlocker, type BlockerFunction } from 'react-router-dom';
import { hasUnsavedChanges } from '@/shared/store/unsavedChanges.store';
import { useAuthStore } from '@/shared/store/auth.store';
import { getOpenAlertId, useAlertStore } from '@/shared/ui/elements/modal/alert/alert.store';
import { TEXTS } from '@/shared/config/texts';

const shouldBlockNavigation: BlockerFunction = ({ currentLocation, nextLocation }) => {
  // 로그아웃·세션만료 시 ProtectedRoute의 강제 리다이렉트까지 막으면 폼에(또는 열린 대화상자에) 갇힌다.
  if (!useAuthStore.getState().isAuthenticated) {
    return false;
  }
  // Alert/Confirm은 히스토리에 묶여있지 않아(T0) 뒤로가기가 그대로 페이지를 이동시켜버린다 -
  // 북마크 페이지처럼 쿼리 파라미터만 바뀌는 이동도 잡아야 해서 pathname 비교보다 먼저 본다.
  if (getOpenAlertId()) {
    return true;
  }
  if (currentLocation.pathname === nextLocation.pathname) {
    return false;
  }
  return hasUnsavedChanges();
};

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (!hasUnsavedChanges()) {
    return;
  }
  e.preventDefault();
  e.returnValue = '';
}

/**
 * 저장하지 않은 입력이 하나라도 등록돼 있으면(useUnsavedChanges) 페이지 이탈을 한 번 막는다.
 * - 앱 내 이동(링크·뒤로가기·programmatic navigate) → 확인 모달
 * - 새로고침·탭 닫기·주소창 이동 → 브라우저 기본 경고
 *
 * data router(createBrowserRouter) 컨텍스트가 필요하며, 앱 전체에서 RootLayout 한 곳에서만 호출한다.
 */
export function useUnsavedChangesGuard() {
  // useAlert()는 호출할 때마다 openConfirm을 새 함수로 감싸 반환해 effect 의존성으로 쓰면
  // 재실행을 반복한다. store의 액션 자체는 참조가 안정적이므로 셀렉터로 직접 가져온다.
  const openConfirm = useAlertStore((state) => state.openConfirm);
  const cancelAlert = useAlertStore((state) => state.cancelAlert);
  const blocker = useBlocker(shouldBlockNavigation);

  const blockerRef = useRef(blocker);
  blockerRef.current = blocker;

  useEffect(
    function confirmBlockedNavigation() {
      if (blocker.state !== 'blocked') {
        return;
      }

      // 열려있는 Alert/Confirm 때문에 막힌 경우 - 그 대화상자를 취소 처리하고 이동은
      // 없었던 일로 한다. "저장하지 않은 변경사항" 확인창을 새로 띄우지 않는다.
      const openAlertId = getOpenAlertId();
      if (openAlertId) {
        cancelAlert(openAlertId);
        blockerRef.current.reset?.();
        return;
      }

      openConfirm({
        title: TEXTS.unsavedChanges.title,
        message: TEXTS.unsavedChanges.message,
        confirmText: TEXTS.unsavedChanges.confirm,
        cancelText: TEXTS.unsavedChanges.cancel,
        onConfirm: () => blockerRef.current.proceed?.(),
        onCancel: () => blockerRef.current.reset?.(),
      });
    },
    [blocker.state, openConfirm, cancelAlert]
  );

  useEffect(function warnBeforeUnload() {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
}
