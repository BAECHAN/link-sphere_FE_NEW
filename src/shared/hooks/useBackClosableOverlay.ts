import { useCallback, useSyncExternalStore } from 'react';
import { useNavigate, type Location } from 'react-router-dom';
import {
  createBackClosableOverlayState,
  type BackClosableOverlayKey,
} from '@/shared/config/back-closable-overlay';
import { RouterEvents } from '@/shared/lib/router/router-events';

// 뒤로를 보낸 위치. navigate(-1)은 popstate를 거쳐 늦게 반영된다 - 그 사이 닫기가 한 번 더 불리면(Esc 조합 중
// keydown 중복, 같은 키를 닫는 컴포넌트가 둘) 뒤로가 두 번 나가 배경 페이지까지 넘어간다. 라우터가 앱에 하나라
// 모듈 변수 하나로 본다. location.key가 아니라 객체로 기억한다 - 앞으로 가기로 같은 칸에 돌아오면 key는 같아도
// 라우터가 위치 객체를 새로 만들어, 그 칸을 다시 닫을 수 있다
let backSentLocation: Location | null = null;

function hasOverlayEntry(location: Location | null, key: BackClosableOverlayKey) {
  return Boolean((location?.state as Record<string, boolean> | null)?.[key]);
}

// subscribe는 컴포넌트 밖에 둔다 - 렌더마다 새 함수를 넘기면 React가 그때마다 다시 구독한다
// (https://react.dev/reference/react/useSyncExternalStore#caveats)
function subscribeToNavigation(onStoreChange: () => void) {
  return RouterEvents.onNavigate(onStoreChange);
}

// 돌려주는 함수는 useCallback으로 고정한다 - 호출하는 쪽이 effect·useCallback의 의존성으로 쓴다
// (useGlobalPostBookmarkFolderDialog.ts의 closeEntryWithoutTarget, https://react.dev/reference/react/useCallback#optimizing-a-custom-hook)
function useOpenOverlay(key: BackClosableOverlayKey) {
  const navigate = useNavigate();

  return useCallback(() => {
    const location = RouterEvents.getLocation();

    // 이미 열려 있으면 칸을 더 쌓지 않는다 - 두 칸이 쌓이면 닫기를 두 번 눌러야 닫힌다. 라우터가 가 있는
    // 위치로 본다 - 커밋된 위치는 페이지를 다 그린 뒤에야 바뀌어 그 전의 두 번째 탭이 지나간다
    if (!location || hasOverlayEntry(location, key)) {
      return;
    }

    // preventScrollReset 없으면 <ScrollRestoration/>이 이 PUSH를 새 페이지로 보고
    // window.scrollTo(0, 0)을 실행해 배경 스크롤이 최상단으로 튄다.
    navigate(`${location.pathname}${location.search}`, {
      state: createBackClosableOverlayState(key),
      preventScrollReset: true,
    });
  }, [navigate, key]);
}

function useOpenOverlayReplacingCurrent(key: BackClosableOverlayKey) {
  const navigate = useNavigate();

  return useCallback(() => {
    const location = RouterEvents.getLocation();

    if (!location) {
      return;
    }

    // 두 번 불려도 같은 칸을 바꿀 뿐이라 열기의 "이미 열려 있으면" 가드가 필요 없다
    navigate(`${location.pathname}${location.search}`, {
      state: createBackClosableOverlayState(key),
      preventScrollReset: true,
      replace: true,
    });
  }, [navigate, key]);
}

/**
 * 뒤로가기로 닫히는 오버레이(시트·창)의 열림 상태. 모든 기기에서 같은 주소의 히스토리 칸 하나로 연다 -
 * 뒤로가기(브라우저 버튼, Android 뒤로 버튼, iOS 스와이프)가 그 칸을 빼면 페이지는 그대로이고 오버레이만 닫힌다.
 * - 열림은 React가 커밋한 위치(useLocation)가 아니라 라우터가 이미 가 있는 위치(RouterEvents)에서 읽는다.
 *   v7_startTransition 때문에 커밋된 위치는 페이지 전체를 다시 그린 뒤에야 바뀌는데, 라우터 구독은 그 전에
 *   불려 오버레이를 그리는 쪽만 먼저 다시 그린다. 외부 값 구독이라 useSyncExternalStore로 읽는다
 *   (https://react.dev/reference/react/useSyncExternalStore). 읽는 값이 이 키 하나의 참·거짓이라 이 오버레이를
 *   여닫을 때만 바뀐다 - 위치 전체를 읽는 usePostListApplying(usePostList.ts)이 이 훅을 피한 경우와 다르다.
 * - 오버레이를 겹쳐 쌓지 않는 것을 전제로 한다(docs/DECISIONS.md 2026-08-07).
 * - 오버레이 안의 링크로 다른 화면으로 떠날 때는 이 칸을 replace로 바꾼다 - 남겨 두면 뒤로 왔을 때 오버레이가
 *   다시 열린다(useMobileSearchPanel.ts의 검색 제출, Sidebar.tsx의 메뉴 링크).
 * 근거와 측정은 docs/BACK-NAVIGATION.md, docs/DECISIONS.md 2026-11-10 항목.
 *
 * @param key 등록부(shared/config/back-closable-overlay.ts)의 키. location.state에 싣는다.
 */
export function useBackClosableOverlay(key: BackClosableOverlayKey) {
  const navigate = useNavigate();
  const isOpen = useSyncExternalStore(subscribeToNavigation, () =>
    hasOverlayEntry(RouterEvents.getLocation(), key)
  );
  const open = useOpenOverlay(key);

  const close = useCallback(() => {
    const location = RouterEvents.getLocation();

    // 이미 닫혀 있는데 back하면 이 칸이 없어 실제 페이지를 떠나므로 반드시 가드한다
    if (!location || !hasOverlayEntry(location, key) || backSentLocation === location) {
      return;
    }

    backSentLocation = location;
    navigate(-1);
  }, [navigate, key]);

  return { isOpen, open, close };
}

/**
 * useBackClosableOverlay의 열기만 쓰는 쪽. 열림을 구독하지 않아, 오버레이를 그리는 쪽이 먼저 다시 그려지는
 * 렌더에 끼지 않는다. 여는 버튼이 여럿이고(피드 카드마다 북마크 버튼) 오버레이는 한 곳(호스트)이 그릴 때 쓴다 -
 * 버튼마다 구독하면 열 때 모든 버튼이 그 렌더에 함께 그려진다. 그 뒤 페이지를 다시 그리는 transition에는 다른
 * 컴포넌트처럼 들어간다(useNavigate가 읽는 RouteContext가 위치마다 새 값이다 - react-router 6.30.3
 * dist/umd/react-router.development.js:670-674, :921).
 *
 * @param key 오버레이를 그리는 쪽이 useBackClosableOverlay에 넘기는 키와 같아야 한다.
 */
export function useBackClosableOverlayOpen(key: BackClosableOverlayKey) {
  return useOpenOverlay(key);
}

/**
 * 다른 오버레이의 칸에서 이어 열 때 쓰는 열기. 칸을 더 넣지 않고 지금 칸을 이 오버레이로 바꾼다 - 먼저 연
 * 오버레이의 칸을 남기면, 닫거나 떠난 뒤 돌아왔을 때 그 오버레이가 다시 열린다(폰 메뉴에서 로그인이 필요한 링크를
 * 누른 경우 - useProtectedNavigate.ts). useBackClosableOverlayOpen처럼 열림을 구독하지 않는다.
 *
 * @param key 오버레이를 그리는 쪽이 useBackClosableOverlay에 넘기는 키와 같아야 한다.
 */
export function useBackClosableOverlayOpenReplacingCurrent(key: BackClosableOverlayKey) {
  return useOpenOverlayReplacingCurrent(key);
}
