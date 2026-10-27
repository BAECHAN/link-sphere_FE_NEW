import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '@/shared/hooks/useIsMobile';

// setup.ts의 matchMedia 스텁은 matches:false 고정이라, 좁은 화면과 change 이벤트를 재현하려면
// 이 파일에서 다시 씌운다. vi.unstubAllGlobals()는 setup.ts의 다른 스텁까지 걷어내므로 쓰지
// 않고(Navbar.test.tsx와 같은 이유) afterEach에서 원래 모양으로 되돌린다.
function stubMatchMedia(initialMatches: boolean) {
  const media = { matches: initialMatches };
  const listeners: Array<() => void> = [];
  const queries: string[] = [];

  vi.stubGlobal('matchMedia', (query: string) => {
    queries.push(query);

    return {
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
    };
  });

  return {
    queries,
    change(matches: boolean) {
      media.matches = matches;
      listeners.forEach((listener) => listener());
    },
  };
}

describe('useIsMobile', () => {
  afterEach(() => {
    stubMatchMedia(false);
    vi.restoreAllMocks();
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

  // CSS(Tailwind md:)가 데스크톱 배치로 그리는 폭에서 JS만 모바일 UI를 고르면 둘이 어긋난다
  it('Tailwind max-md와 같은 조건으로 묻는다', () => {
    const mediaQuery = stubMatchMedia(false);

    renderHook(() => useIsMobile());

    expect(new Set(mediaQuery.queries)).toEqual(new Set(['(width < 48rem)']));
  });

  it('UA가 모바일이어도 넓은 화면이면 false다 (휴대폰 가로·태블릿)', () => {
    stubMatchMedia(false);
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    );

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
