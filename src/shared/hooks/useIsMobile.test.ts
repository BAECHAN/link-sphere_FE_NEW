import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '@/shared/hooks/useIsMobile';

// setup.ts의 matchMedia 스텁은 matches:false 고정이라, 좁은 화면과 change 이벤트를 재현하려면
// 이 파일에서 다시 씌운다. vi.unstubAllGlobals()는 setup.ts의 다른 스텁까지 걷어내므로 쓰지
// 않고(Navbar.test.tsx와 같은 이유) afterEach에서 원래 모양으로 되돌린다.
function stubMatchMedia(initialMatches: boolean) {
  const media = { matches: initialMatches };
  const listeners: Array<() => void> = [];

  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return media.matches;
    },
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  return {
    change(matches: boolean) {
      media.matches = matches;
      listeners.forEach((listener) => listener());
    },
  };
}

describe('useIsMobile', () => {
  afterEach(() => {
    stubMatchMedia(false);
  });

  it('첫 렌더부터 좁은 화면이면 true다 (데스크톱 UI가 잠깐 보이는 깜빡임 방지)', () => {
    stubMatchMedia(true);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it('넓은 화면이면 false다', () => {
    stubMatchMedia(false);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it('화면 크기가 바뀌면 값이 따라 바뀐다', () => {
    const mediaQuery = stubMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());

    act(() => {
      mediaQuery.change(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      mediaQuery.change(false);
    });
    expect(result.current).toBe(false);
  });
});
