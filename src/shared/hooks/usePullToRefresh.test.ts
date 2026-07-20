import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePullToRefresh } from '@/shared/hooks/usePullToRefresh';

// 모바일 게이트를 항상 통과시켜 순수 당김 로직만 검증
vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: () => true,
}));

function fireTouch(type: 'touchstart' | 'touchmove' | 'touchend', clientY: number) {
  const event = new Event(type, { cancelable: true, bubbles: true }) as TouchEvent;
  Object.defineProperty(event, 'touches', {
    value: [{ clientY }],
    configurable: true,
  });
  window.dispatchEvent(event);
}

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, configurable: true });
}

describe('usePullToRefresh', () => {
  beforeEach(() => {
    setScrollY(0);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('최상단에서 임계값을 넘겨 당기면 onRefresh를 호출한다', () => {
    const onRefresh = vi.fn();
    // resistance 1 → deltaY 그대로가 pullDistance, threshold 70
    renderHook(() => usePullToRefresh({ onRefresh, threshold: 70, resistance: 1 }));

    act(() => {
      fireTouch('touchstart', 0);
      fireTouch('touchmove', 100);
      fireTouch('touchend', 100);
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('임계값에 못 미치면 onRefresh를 호출하지 않는다', () => {
    const onRefresh = vi.fn();
    renderHook(() => usePullToRefresh({ onRefresh, threshold: 70, resistance: 1 }));

    act(() => {
      fireTouch('touchstart', 0);
      fireTouch('touchmove', 40);
      fireTouch('touchend', 40);
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('최상단이 아니면(스크롤 중) 당겨도 onRefresh를 호출하지 않는다', () => {
    const onRefresh = vi.fn();
    setScrollY(200);
    renderHook(() => usePullToRefresh({ onRefresh, threshold: 70, resistance: 1 }));

    act(() => {
      fireTouch('touchstart', 0);
      fireTouch('touchmove', 100);
      fireTouch('touchend', 100);
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('enabled=false면 당겨도 호출하지 않는다', () => {
    const onRefresh = vi.fn();
    renderHook(() => usePullToRefresh({ onRefresh, enabled: false, threshold: 70, resistance: 1 }));

    act(() => {
      fireTouch('touchstart', 0);
      fireTouch('touchmove', 100);
      fireTouch('touchend', 100);
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });
});
