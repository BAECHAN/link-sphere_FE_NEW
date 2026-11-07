import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * 화면을 덮는 오버레이(모바일 드로어·모달 등)의 열림 상태를 히스토리 엔트리로 관리한다.
 * 열 때 새 엔트리를 push하므로 뒤로가기(하드웨어 버튼·엣지 스와이프)를 누르면
 * 페이지 이동이 아니라 이 엔트리가 pop되며 오버레이만 자연스럽게 닫힌다.
 * (Navbar의 모바일 검색 패널과 동일한 패턴 - 오버레이를 겹쳐 쌓지 않는 것을 전제로 한다)
 * 오버레이 안의 링크로 다른 화면으로 떠날 때는 이 엔트리를 replace로 교체한다 - 남겨 두면 뒤로 왔을 때
 * 오버레이가 다시 열린다(useMobileSearchPanel.ts의 검색 제출, Sidebar.tsx의 메뉴 링크).
 *
 * @param key location.state에 실을 키. 오버레이마다 고유해야 한다.
 */
export function useHistoryOverlay(key: string) {
  const navigate = useNavigate();
  const location = useLocation();

  const isOpen = Boolean((location.state as Record<string, boolean> | null)?.[key]);

  const open = useCallback(() => {
    // 이미 열려 있으면 엔트리를 더 쌓지 않는다 - 오버레이 코드를 받는 동안(lazy) 화면이 비어
    // 한 번 더 누르면 엔트리가 두 칸 쌓여 닫기를 두 번 눌러야 닫혔다(로그인 창, 2026-10-28)
    if (isOpen) {
      return;
    }

    // preventScrollReset 없으면 <ScrollRestoration/>이 이 PUSH를 새 페이지로 보고
    // window.scrollTo(0, 0)을 실행해 배경 스크롤이 최상단으로 튄다.
    navigate(`${location.pathname}${location.search}`, {
      state: { [key]: true },
      preventScrollReset: true,
    });
  }, [isOpen, navigate, location.pathname, location.search, key]);

  // 다른 오버레이 엔트리에서 이어 열 때 쓴다 - 그 엔트리를 이 오버레이로 바꿔, 닫거나 떠난 뒤 돌아와도
  // 먼저 연 오버레이가 다시 열리지 않는다. 두 번 불려도 같은 칸을 바꿀 뿐이라 open의 가드가 필요 없다.
  const openReplacingCurrent = useCallback(() => {
    navigate(`${location.pathname}${location.search}`, {
      state: { [key]: true },
      preventScrollReset: true,
      replace: true,
    });
  }, [navigate, location.pathname, location.search, key]);

  // navigate(-1)은 popstate를 거쳐 비동기로 반영된다 - 그 사이 close()가 한 번 더 불리면
  // isOpen이 아직 true라 위 가드를 그냥 통과해 back이 두 번 나가고 배경 페이지까지
  // 넘어간다(예: ESC 조합 중 keydown이 중복 발생하는 경우). 엔트리별로 한 번만 보내도록 래치한다.
  const backSentRef = useRef(false);

  useEffect(
    function rearmForCurrentEntry() {
      backSentRef.current = false;
    },
    [location.key, isOpen]
  );

  const close = useCallback(() => {
    // 이미 닫혀 있는데 back하면 이 엔트리가 없어 실제 페이지를 떠나므로 반드시 가드한다
    if (!isOpen || backSentRef.current) {
      return;
    }
    backSentRef.current = true;
    navigate(-1);
  }, [isOpen, navigate]);

  return { isOpen, open, openReplacingCurrent, close };
}
