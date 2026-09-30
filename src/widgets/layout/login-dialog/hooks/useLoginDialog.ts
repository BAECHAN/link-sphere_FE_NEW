import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLoginDialogStore } from '@/shared/store/loginDialog.store';
import { useAuthStore } from '@/shared/store/auth.store';
import { useHistoryOverlay } from '@/shared/hooks/useHistoryOverlay';
import { ROUTES_PATHS } from '@/shared/config/route-paths';

/**
 * 전역 로그인 유도 모달의 열림/닫힘 전이·재개 로직.
 * 콜백은 loginDialog.store가, 열림 상태는 히스토리 엔트리가 관리한다.
 */
export function useLoginDialog() {
  const { onSuccess, setOnSuccess, pendingAction, setPendingAction } = useLoginDialogStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { pathname } = useLocation();
  const { isOpen, close } = useHistoryOverlay('loginDialogOpen');

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
  // (useHistoryOverlay.ts - 오버레이를 겹쳐 쌓지 않는 것을 전제로 한다).
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
    if (isOpen && (pathname === ROUTES_PATHS.AUTH.LOGIN || pathname === ROUTES_PATHS.AUTH.SIGNUP)) {
      setOnSuccess(undefined);
      close();
    }
  }, [isOpen, pathname, setOnSuccess, close]);

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

  return { isOpen, handleOpenChange, hasUserInput, handleInputDirtyChange: setHasUserInput };
}
