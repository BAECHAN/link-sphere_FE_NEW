import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { PanInfo } from 'framer-motion';
import type { ReactNode } from 'react';
import { useSwipeNavigation } from '@/shared/hooks/useSwipeNavigation';

const mockIsMobile = vi.fn<() => boolean>(() => true);
vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: () => mockIsMobile(),
}));

// offset.x / velocity.x 만 사용하므로 최소 형태로 구성
function panInfo(offsetX: number, velocityX = 0): PanInfo {
  return {
    point: { x: 0, y: 0 },
    delta: { x: 0, y: 0 },
    offset: { x: offsetX, y: 0 },
    velocity: { x: velocityX, y: 0 },
  };
}

function renderSwipe(initialPath: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
  );
  return renderHook(() => ({ swipe: useSwipeNavigation(), pathname: useLocation().pathname }), {
    wrapper,
  });
}

function dragEnd(result: ReturnType<typeof renderSwipe>['result'], info: PanInfo) {
  act(() => {
    result.current.swipe.onDragEnd(new MouseEvent('mouseup'), info);
  });
}

beforeEach(() => {
  mockIsMobile.mockReturnValue(true);
});

describe('useSwipeNavigation', () => {
  it('모바일 + 메인 탭에서 enabled 이다', () => {
    const { result } = renderSwipe('/post');
    expect(result.current.swipe.enabled).toBe(true);
  });

  it('데스크탑에서는 disabled 이다', () => {
    mockIsMobile.mockReturnValue(false);
    const { result } = renderSwipe('/post');
    expect(result.current.swipe.enabled).toBe(false);
  });

  it('상세/편집 등 메인 탭이 아닌 경로에서는 disabled 이다', () => {
    expect(renderSwipe('/post/123').result.current.swipe.enabled).toBe(false);
    expect(renderSwipe('/post/edit/123').result.current.swipe.enabled).toBe(false);
  });

  it('왼쪽 드래그(임계값 초과)는 다음 메뉴로 이동한다', () => {
    const { result } = renderSwipe('/post');
    dragEnd(result, panInfo(-100));
    expect(result.current.pathname).toBe('/post/submit');
  });

  it('오른쪽 드래그(임계값 초과)는 이전 메뉴로 이동한다', () => {
    const { result } = renderSwipe('/bookmark');
    dragEnd(result, panInfo(100));
    expect(result.current.pathname).toBe('/post/submit');
  });

  it('거리 임계값 미달이면 이동하지 않는다', () => {
    const { result } = renderSwipe('/post');
    dragEnd(result, panInfo(-50));
    expect(result.current.pathname).toBe('/post');
  });

  it('거리는 미달이어도 속도 임계값을 넘으면 이동한다', () => {
    const { result } = renderSwipe('/post');
    dragEnd(result, panInfo(-30, -800));
    expect(result.current.pathname).toBe('/post/submit');
  });

  it('마지막 탭에서 다음 드래그는 무시된다(clamp)', () => {
    const { result } = renderSwipe('/bookmark');
    dragEnd(result, panInfo(-100));
    expect(result.current.pathname).toBe('/bookmark');
  });

  it('첫 탭에서 이전 드래그는 무시된다(clamp)', () => {
    const { result } = renderSwipe('/post');
    dragEnd(result, panInfo(100));
    expect(result.current.pathname).toBe('/post');
  });

  it('글쓰기 탭은 큰 임계값을 사용한다(80px 드래그로는 이동 안 함)', () => {
    const { result } = renderSwipe('/post/submit');
    dragEnd(result, panInfo(-100));
    expect(result.current.pathname).toBe('/post/submit');
  });

  it('글쓰기 탭도 큰 임계값을 넘기면 이동한다', () => {
    const { result } = renderSwipe('/post/submit');
    dragEnd(result, panInfo(-200));
    expect(result.current.pathname).toBe('/bookmark');
  });
});
