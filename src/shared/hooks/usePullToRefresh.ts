import { useEffect, useRef, useState } from 'react';

// 당김은 터치 제스처라 화면 폭이 아니라 주 입력 장치로 정한다 - 폭으로 정하면 휴대폰 가로·태블릿처럼
// 넓은 터치 기기에서 꺼진다. MDN "Browser detection using the user agent"도 터치 여부는 UA·폭이 아니라
// 기능으로 감지하라고 권한다(https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Browser_detection_using_the_user_agent).
const TOUCH_POINTER_QUERY = '(pointer: coarse)';

interface UsePullToRefreshProps {
  onRefresh: () => void | Promise<unknown>;
  enabled?: boolean;
  /** 새로고침을 트리거하는 당김 거리(px) */
  threshold?: number;
  /** 인디케이터가 늘어나는 최대 거리(px) */
  maxPull?: number;
  /** 당김 저항 계수 (0~1, 낮을수록 뻑뻑함) */
  resistance?: number;
}

/**
 * 터치가 주 입력인 기기에서 화면 최상단(window.scrollY === 0)을 아래로 당기면 onRefresh를 호출하는 훅.
 * 이 앱은 전용 스크롤 컨테이너 없이 window/body 스크롤을 쓰므로 리스너를 window에 붙인다.
 */
export function usePullToRefresh({
  onRefresh,
  enabled = true,
  threshold = 70,
  maxPull = 120,
  resistance = 0.5,
}: UsePullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  const startYRef = useRef<number | null>(null);
  // touchend가 렌더 타이밍과 무관하게 최신 당김 거리를 읽도록 ref로 추적한다
  const pullDistanceRef = useRef(0);

  useEffect(
    function attachPullToRefreshListeners() {
      if (!enabled || !window.matchMedia(TOUCH_POINTER_QUERY).matches) {
        return;
      }

      const updatePull = (distance: number) => {
        pullDistanceRef.current = distance;
        setPullDistance(distance);
      };

      const handleTouchStart = (e: TouchEvent) => {
        const touch = e.touches[0];
        startYRef.current = touch && window.scrollY <= 0 ? touch.clientY : null;
      };

      const handleTouchMove = (e: TouchEvent) => {
        const touch = e.touches[0];
        if (startYRef.current === null || !touch) {
          return;
        }

        const deltaY = touch.clientY - startYRef.current;
        if (deltaY <= 0) {
          setIsPulling(false);
          updatePull(0);
          return;
        }

        // 당기는 중에는 네이티브 오버스크롤/새로고침을 막는다
        e.preventDefault();
        setIsPulling(true);
        updatePull(Math.min(deltaY * resistance, maxPull));
      };

      const handleTouchEnd = () => {
        if (startYRef.current !== null && pullDistanceRef.current >= threshold) {
          onRefresh();
        }

        startYRef.current = null;
        setIsPulling(false);
        updatePull(0);
      };

      window.addEventListener('touchstart', handleTouchStart, { passive: true });
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);

      return () => {
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      };
    },
    [enabled, onRefresh, threshold, maxPull, resistance]
  );

  return { pullDistance, isPulling, isReady: pullDistance >= threshold };
}
