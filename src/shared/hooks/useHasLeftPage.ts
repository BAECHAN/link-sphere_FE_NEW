import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { RouterEvents } from '@/shared/lib/router/router-events';

/**
 * 비동기 응답을 기다린 뒤 "그 사이 사용자가 이 화면을 떠났는지" 확인하는 함수를 돌려준다.
 * 저장 중 "나가기"로 떠났을 때, 응답 처리(성공 이동·실패 안내)가 옮겨 간 화면을 덮어쓰지 않게 하는 데 쓴다.
 *
 * - 언마운트됐으면 떠난 것이다
 * - 아직 마운트돼 있어도 라우터가 이미 다른 경로에 가 있으면 떠난 것이다 - `v7_startTransition` 때문에
 *   다음 화면이 청크·데이터로 suspend하는 동안(정지 구간)엔 이전 화면이 마운트된 채 남는다(router-events.ts)
 * - 경로는 그대로이고 key만 바뀐 이동(같은 화면 위 오버레이, useHistoryOverlay)은 떠난 것이 아니다
 *
 * 라우터를 주입하지 않은 환경(MemoryRouter 테스트)에서는 마운트 여부만 본다.
 */
export function useHasLeftPage() {
  const { pathname } = useLocation();
  const isMountedRef = useRef(false);

  useEffect(function trackMounted() {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return () => {
    if (!isMountedRef.current) {
      return true;
    }

    const latestLocation = RouterEvents.getLocation();

    return latestLocation !== null && latestLocation.pathname !== pathname;
  };
}
