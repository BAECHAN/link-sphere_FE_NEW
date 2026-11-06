import { useEffect, useRef, useLayoutEffect } from 'react';
import { useBlocker, useLocation, type BlockerFunction } from 'react-router-dom';
import {
  getPendingSubmitTexts,
  hasUnsavedChanges,
  useUnsavedChangesStore,
} from '@/shared/store/unsavedChanges.store';
import { useAuthStore } from '@/shared/store/auth.store';
import {
  getOpenAlertDialogId,
  useAlertDialogStore,
} from '@/shared/ui/elements/dialog/alert-dialog/alertDialog.store';
import { PUBLIC_PATHS, ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

// 로그인·회원가입 페이지(GuestGuard 전용)는 원래도 비로그인만 볼 수 있어 ProtectedRoute
// 강제 리다이렉트에 갇힐 위험이 없다 - 비로그인 예외에서 뺀다.
function isGuestOnlyPage(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => path === pathname);
}

const shouldBlockNavigation: BlockerFunction = ({ currentLocation, nextLocation }) => {
  const { isAuthenticated, signedOutInPlace } = useAuthStore.getState();

  // 로그아웃·세션만료 시 ProtectedRoute의 강제 리다이렉트까지 막으면 폼에(또는 열린 대화상자에) 갇힌다.
  // 단 로그인이 풀린 채 쓰던 화면에 둔 동안(signedOutInPlace)에는 강제 리다이렉트가 없으므로 평소처럼 막는다 -
  // 로그인 창을 닫고 다른 화면으로 가면 쓰던 글이 확인 없이 사라진다(docs/plans/2026-10-28-keep-writing-in-place.md 결정 5)
  if (!isAuthenticated && !signedOutInPlace && !isGuestOnlyPage(currentLocation.pathname)) {
    return false;
  }
  // Alert/Confirm은 히스토리에 묶여있지 않아(T0) 뒤로가기가 그대로 페이지를 이동시켜버린다 -
  // 북마크 페이지처럼 쿼리 파라미터만 바뀌는 이동도 잡아야 해서 pathname 비교보다 먼저 본다.
  if (getOpenAlertDialogId()) {
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
  // useAlertDialog()는 호출할 때마다 openConfirm을 새 함수로 감싸 반환해 effect 의존성으로 쓰면
  // 재실행을 반복한다. store의 액션 자체는 참조가 안정적이므로 셀렉터로 직접 가져온다.
  const openConfirm = useAlertDialogStore((state) => state.openConfirm);
  const cancelAlertDialog = useAlertDialogStore((state) => state.cancelAlertDialog);
  const blocker = useBlocker(shouldBlockNavigation);
  const { pathname } = useLocation();

  const blockerRef = useRef(blocker);
  // 가드가 띄운 이탈 확인창의 id. 답하면(나가기·계속 작성) 비운다
  const confirmIdRef = useRef<string | null>(null);
  // 그 확인창을 응답을 기다리는 중에 띄웠는지(usePendingSubmit) - 그랬다면 응답이 오면 닫는다
  const openedWhilePendingRef = useRef(false);

  // 렌더 중이 아니라 레이아웃 effect에서 갱신한다 - 렌더 중 ref 쓰기는 React 규칙 위반이고
  // (https://react.dev/reference/eslint-plugin-react-hooks/lints/refs), 공식 대안인
  // useEffectEvent는 React 19.2부터(https://react.dev/blog/2025/10/01/react-19-2)라 React 18인
  // 이 레포에선 쓸 수 없다. 레이아웃 effect는 일반 effect·이벤트보다 먼저 돌아
  // 읽는 쪽은 항상 최신 값을 본다
  useLayoutEffect(() => {
    blockerRef.current = blocker;
  });

  useEffect(
    function confirmBlockedNavigation() {
      if (blocker.state !== 'blocked') {
        return;
      }

      // 열려있는 Alert/Confirm 때문에 막힌 경우 - 그 대화상자를 취소 처리하고 이동은
      // 없었던 일로 한다. "저장하지 않은 변경사항" 확인창을 새로 띄우지 않는다.
      const openAlertDialogId = getOpenAlertDialogId();
      if (openAlertDialogId) {
        cancelAlertDialog(openAlertDialogId);
        blockerRef.current.reset?.();
        return;
      }

      // 응답을 기다리는 폼이 있으면 그 폼이 등록한 문구를 쓴다 - 이미 요청을 보내 지금 나가도 취소되지 않는다.
      // 없으면 회원가입 페이지는 폼이 하나뿐이라 pathname만으로 전용 문구를 고를 수 있다.
      const pendingTexts = getPendingSubmitTexts();
      const texts =
        pendingTexts ??
        (pathname === ROUTES_PATHS.AUTH.SIGNUP
          ? TEXTS.unsavedChanges.signup
          : TEXTS.unsavedChanges);

      openConfirm({
        title: texts.title,
        message: texts.message,
        confirmText: texts.confirm,
        cancelText: texts.cancel,
        onConfirm: () => {
          confirmIdRef.current = null;
          blockerRef.current.proceed?.();
        },
        onCancel: () => {
          confirmIdRef.current = null;
          blockerRef.current.reset?.();
        },
      });
      // openConfirm은 id를 돌려주지 않는다 - 바로 위에서 열린 확인창이 없음을 확인했으니
      // 지금 열려 있는 것이 방금 띄운 확인창이다
      confirmIdRef.current = getOpenAlertDialogId();
      openedWhilePendingRef.current = pendingTexts !== null;
    },
    [blocker.state, openConfirm, cancelAlertDialog, pathname]
  );

  useEffect(
    function cancelOutdatedConfirm() {
      // 확인창이 떠 있는 동안 그 문구의 전제가 사라지면 확인창을 취소(막힌 이동은 reset)한다.
      // - 저장이 끝나 작성 중인 폼이 모두 해제됨: "입력한 내용이 사라져요"가 틀린다. 폼의 성공 이동이
      //   평소대로 통과해야 한다 - 그대로 두면 그 이동이 열린 확인창 때문에 다시 막히고(blocked→blocked)
      //   "계속 작성"이 버린다(docs/UNSAVED-CHANGES-GUARD.md §10, 2026-10-21)
      // - 응답을 기다리는 중에 띄운 확인창인데 응답이 옴(성공·실패 모두): "취소되지 않아요"가 틀린다.
      //   실패하면 입력이 남아 위 조건으로는 닫히지 않으므로 따로 본다 - 화면에 머물러 실패 안내를 보게 한다
      //   (docs/UNSAVED-CHANGES-GUARD.md §5 "저장 요청 중 이탈", 2026-11-02 사용자 결정)
      // clearNow() 직후 같은 틱에 navigate가 오므로 렌더 뒤에 도는 선택자 구독이 아니라 동기로 불리는
      // store.subscribe로 받는다
      // (https://github.com/pmndrs/zustand#readingwriting-state-and-reacting-to-changes-outside-components,
      // 외부 저장소 구독은 effect에서 - https://react.dev/reference/react/useEffect).
      return useUnsavedChangesStore.subscribe(() => {
        const confirmId = confirmIdRef.current;

        if (!confirmId) {
          return;
        }

        const isResponseIn = openedWhilePendingRef.current && getPendingSubmitTexts() === null;

        if (hasUnsavedChanges() && !isResponseIn) {
          return;
        }

        cancelAlertDialog(confirmId);
      });
    },
    [cancelAlertDialog]
  );

  useEffect(function warnBeforeUnload() {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
}
