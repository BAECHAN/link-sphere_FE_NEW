import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  useLoginDialogStore,
  type LoginDialogLocationState,
} from '@/shared/store/loginDialog.store';
import { useAuthStore } from '@/shared/store/auth.store';
import { useBackClosableOverlay } from '@/shared/hooks/useBackClosableOverlay';
import { RouterEvents } from '@/shared/lib/router/router-events';
import { ROUTES_PATHS } from '@/shared/config/route-paths';

// subscribe는 컴포넌트 밖에 둔다 - 렌더마다 새 함수를 넘기면 React가 그때마다 다시 구독한다
// (https://react.dev/reference/react/useSyncExternalStore#caveats)
function subscribeToNavigation(onStoreChange: () => void) {
  return RouterEvents.onNavigate(onStoreChange);
}

function getSignedOutReasonInRouterLocation() {
  return (RouterEvents.getLocation()?.state as LoginDialogLocationState | null)?.loginDialogReason;
}

function isRouterOnAuthPage() {
  const pathname = RouterEvents.getLocation()?.pathname;

  return pathname === ROUTES_PATHS.AUTH.LOGIN || pathname === ROUTES_PATHS.AUTH.SIGNUP;
}

/**
 * 전역 로그인 유도 모달의 열림/닫힘 전이·재개 로직.
 * 콜백은 loginDialog.store가, 열림 상태는 히스토리 엔트리가 관리한다.
 */
export function useLoginDialog() {
  const { onSuccess, setOnSuccess, pendingAction, setPendingAction } = useLoginDialogStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { isOpen, close } = useBackClosableOverlay('loginDialogOpen');
  // 이 훅이 위치에서 읽는 값은 모두 열림과 같은 곳(라우터가 가 있는 위치)에서 읽는다. 커밋된 위치(useLocation)는
  // 페이지를 다 그린 뒤에야 바뀌어(useBackClosableOverlay.ts), 섞어 읽으면 창은 새 위치로, 나머지는 이전 화면으로 판정한다.
  // - auth 페이지인지: 회원가입 화면에서 뒤로 와 창이 열린 칸에 돌아오면, 화면은 아직 회원가입 화면이라 돌아온 창을
  //   "auth 페이지에서 열렸다"로 보고 닫아 버린다
  // - 이유: 먼저 뜬 창이 기본 문구로 보였다가 이유 문구로 바뀐다
  const isOnAuthPage = useSyncExternalStore(subscribeToNavigation, isRouterOnAuthPage);
  // 로그인이 풀려 쓰던 화면에서 연 창이면 그 이유(AuthUtil이 history state에 싣는다) - 제목·설명이 이유를 알린다.
  // 닫히면 state에서 이유가 빠지므로, 닫히는 애니메이션 동안 기본 문구로 바뀌어 보이지 않게 열려 있던 때의 값을 붙잡는다.
  // 렌더 중에 읽으므로 state로 들고 렌더 중에 맞춘다(ProtectedRoute의 hasBeenAuthenticated와 같은 방식,
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  const reasonInState = useSyncExternalStore(
    subscribeToNavigation,
    getSignedOutReasonInRouterLocation
  );
  const [reason, setReason] = useState(reasonInState);

  if (isOpen && reasonInState !== reason) {
    setReason(reasonInState);
  }

  // 로그인 성공 → onSuccess(원래 가려던 페이지 이동 등) 실행 후 닫기.
  // onSuccess가 있으면 그 navigate가 이미 이 위치(loginDialogOpen인 엔트리)를 벗어나므로
  // 모달은 자연히 닫힌다 - 여기서 close()(navigate(-1))까지 같이 부르면 onSuccess가 남긴
  // 새 엔트리 바로 뒤인 이 모달 엔트리 자신으로 되돌아가버려 모달이 안 닫히고 X·ESC·backdrop도
  // 무반응이 된다(Sidebar.tsx의 드로어 close() 제거와 동일한 이유의 레이스).
  // handledRef: setOnSuccess(undefined) 자체가 store 구독을 통해 이 effect를 한 번 더 돌게 만든다 -
  // 재실행 시점엔 onSuccess가 이미 비워진 뒤라 else 분기(close)로 잘못 빠지므로, 이 열림 주기당
  // 딱 한 번만 분기를 태우도록 막는다.
  const handledSuccessRef = useRef(false);
  useEffect(
    function closeDialogOnLoginSuccess() {
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
    },
    [isOpen, isAuthenticated, onSuccess, setOnSuccess, close]
  );

  // pendingAction(재개 액션)은 위 effect의 close()가 실제로 반영돼 로그인 모달이
  // 사라진 뒤에만 실행한다. close()는 navigate(-1) → popstate라 비동기다 - 성공
  // 즉시 실행하면 로그인 모달이 아직 떠 있는 채로 다음 모달이 위에 겹친다
  // (useBackClosableOverlay.ts - 오버레이를 겹쳐 쌓지 않는 것을 전제로 한다).
  // openedRef: 이 effect는 "열려 있다가 닫힌" 전이에서만 동작해야 한다. useAuthGuard가
  // setPendingAction 직후 openLoginDialog()을 부르는 찰나(아직 isOpen=false)에 그냥
  // 돌면 열어보기도 전에 액션을 버린다 - handledSuccessRef와 같은 이유의 래치다.
  // 닫힘 경로 4가지(로그인 성공/X·ESC·backdrop 취소/하드웨어 뒤로가기/auth 페이지 이동)가
  // 전부 "isOpen이 false가 된다"는 이 지점으로 수렴하므로, 성공이 아닌 닫힘에서는
  // 액션을 실행하지 않고 버린다.
  const openedRef = useRef(false);
  useEffect(
    function runPendingActionAfterDialogCloses() {
      if (isOpen) {
        openedRef.current = true;
        return;
      }
      if (!openedRef.current || !pendingAction) {
        return;
      }
      openedRef.current = false;
      if (isAuthenticated) {
        pendingAction();
      }
      setPendingAction(undefined);
    },
    [isOpen, isAuthenticated, pendingAction, setPendingAction]
  );

  // 회원가입 등 auth 페이지로 이동 시 모달 닫기 (onSuccess는 실행하지 않음)
  useEffect(() => {
    if (isOpen && isOnAuthPage) {
      setOnSuccess(undefined);
      close();
    }
  }, [isOpen, isOnAuthPage, setOnSuccess, close]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setOnSuccess(undefined);
      close();
    }
  };

  // 이메일·비밀번호를 입력했으면 바깥 클릭으로 닫지 않는다 — 닫히면 입력이 사라진다
  // (docs/DECISIONS.md 2026-09-30 "바깥 클릭 닫기 정책"). ESC·X·뒤로가기는 그대로 닫는다.
  // 모달이 닫히면 LoginForm이 언마운트되고, 다시 열 때 새 폼이 마운트되며 false를 알린다.
  const [hasUserInput, setHasUserInput] = useState(false);

  return {
    isOpen,
    reason,
    handleOpenChange,
    hasUserInput,
    handleInputDirtyChange: setHasUserInput,
  };
}
