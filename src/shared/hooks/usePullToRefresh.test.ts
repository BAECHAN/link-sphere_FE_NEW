import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePullToRefresh } from '@/shared/hooks/usePullToRefresh';

// setup.ts의 matchMedia 스텁은 matches:false 고정이다. 터치 기기(pointer: coarse)로 보이게 다시
// 씌우고, afterEach에서 터치가 아닌 기기로 되돌린다(useIsMobile.test.ts와 같은 이유로 unstubAllGlobals 미사용).
function stubPointer(pointer: 'coarse' | 'fine') {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === `(pointer: ${pointer})`,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

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
    stubPointer('coarse');
  });

  afterEach(() => {
    stubPointer('fine');
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

  // 휴대폰 가로·태블릿처럼 폭이 넓어도 터치 기기면 켜지고, 마우스·트랙패드가 주 입력이면 꺼진다
  it('터치가 주 입력이 아니면 당겨도 호출하지 않는다', () => {
    stubPointer('fine');
    const onRefresh = vi.fn();
    renderHook(() => usePullToRefresh({ onRefresh, threshold: 70, resistance: 1 }));

    act(() => {
      fireTouch('touchstart', 0);
      fireTouch('touchmove', 100);
      fireTouch('touchend', 100);
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });
});
