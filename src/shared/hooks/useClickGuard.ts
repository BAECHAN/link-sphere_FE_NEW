import { useCallback, useRef } from 'react';

/**
 * 마우스 스위치 채터링(접점 불량)으로 사람이 낼 수 없는 속도의 중복 클릭이 들어오면
 * 무시하는 가드 훅. 토글 버튼은 짝수 번 눌리면 원래 상태로 되돌아가 "눌렀는데 반영
 * 안 됨"처럼 보이는데, 이 중 채터링이 원인인 경우만 걸러낸다 — 사람의 의도적인
 * 빠른 재클릭(수십~수백ms)은 그대로 통과시킨다.
 *
 * 기본값 8ms는 게이밍 마우스 소프트웨어(Logitech G Hub 등)가 노출하는 채터링 방지
 * debounce 설정값을 그대로 따른 것이다 — _"Bumping it to 8 ms hides most low-grade
 * chatter"_ (Angry Miao, https://store.angrymiao.com/blogs/insider-stories/how-to-fix-mouse-double-clicking).
 *
 * @param thresholdMs - 이 시간(ms) 이내의 재호출은 무시한다 (기본값 8ms)
 * @returns 호출 시점이 임계값을 넘었으면 true(진행), 아니면 false(무시)
 */
export function useClickGuard(thresholdMs: number = 8) {
  const lastCallRef = useRef(0);

  return useCallback(() => {
    const now = Date.now();

    if (now - lastCallRef.current < thresholdMs) {
      return false;
    }

    lastCallRef.current = now;
    return true;
  }, [thresholdMs]);
}
