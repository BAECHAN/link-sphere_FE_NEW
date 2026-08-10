import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useHistoryOverlay } from '@/shared/hooks/useHistoryOverlay';

const navigateSpy = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

function Wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={['/post/1']}>{children}</MemoryRouter>;
}

describe('useHistoryOverlay', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
  });

  it('open은 preventScrollReset과 함께 히스토리 엔트리를 push한다', () => {
    // 이게 없으면 <ScrollRestoration/>이 PUSH를 새 페이지로 보고 배경 스크롤을
    // 최상단으로 리셋해버린다 (라이트박스/로그인 모달 등 열 때 배경이 튀는 버그).
    const { result } = renderHook(() => useHistoryOverlay('imageViewerOpen'), {
      wrapper: Wrapper,
    });

    result.current.open();

    expect(navigateSpy).toHaveBeenCalledWith('/post/1', {
      state: { imageViewerOpen: true },
      preventScrollReset: true,
    });
  });

  it('닫혀 있을 때 close는 navigate(-1)을 호출하지 않는다', () => {
    const { result } = renderHook(() => useHistoryOverlay('imageViewerOpen'), {
      wrapper: Wrapper,
    });

    result.current.close();

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
