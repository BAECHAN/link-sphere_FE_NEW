import { useEffect, useRef, useState } from 'react';

import { useIsMobile } from '@/shared/hooks/useIsMobile';

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
 * 모바일에서 화면 최상단(window.scrollY === 0)을 아래로 당기면 onRefresh를 호출하는 훅.
 * 이 앱은 전용 스크롤 컨테이너 없이 window/body 스크롤을 쓰므로 리스너를 window에 붙인다.
 */
export function usePullToRefresh({
  onRefresh,
  enabled = true,
  threshold = 70,
  maxPull = 120,
  resistance = 0.5,
}: UsePullToRefreshProps) {
  const isMobile = useIsMobile();
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  const startYRef = useRef<number | null>(null);
  // touchend가 렌더 타이밍과 무관하게 최신 당김 거리를 읽도록 ref로 추적한다
  const pullDistanceRef = useRef(0);

  const active = enabled && isMobile;

  useEffect(
    function attachPullToRefreshListeners() {
      if (!active) {
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
    [active, onRefresh, threshold, maxPull, resistance]
  );

  return { pullDistance, isPulling, isReady: pullDistance >= threshold };
}
