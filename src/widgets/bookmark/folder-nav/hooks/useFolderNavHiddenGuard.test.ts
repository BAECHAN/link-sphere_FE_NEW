import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFolderNavHiddenGuard } from '@/widgets/bookmark/folder-nav/hooks/useFolderNavHiddenGuard';

// setup.ts의 matchMedia 스텁은 matches:false(넓은 화면) 고정이다. 폭이 경계를 넘는 순간을 재현하려고 이 파일에서 다시
// 씌운다(CommentComposer.test.tsx와 같은 방식 - vi.unstubAllGlobals()는 setup.ts의 다른 스텁까지 걷어내므로 쓰지 않고
// afterEach에서 원래 모양으로 되돌린다).
function stubViewport(initial: 'narrow' | 'wide') {
  const media = { matches: initial === 'narrow' };
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
    /** 폭이 768px 경계를 넘는다 */
    resizeTo(next: 'narrow' | 'wide') {
      media.matches = next === 'narrow';
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

afterEach(() => {
  stubViewport('wide');
});

describe('useFolderNavHiddenGuard — 열린 ⋮ 메뉴', () => {
  it.each([
    {
      label: '사이드바(넓은 화면)를 좁히면',
      shownOn: 'wide' as const,
      from: 'wide' as const,
      to: 'narrow' as const,
    },
    {
      label: '폴더 카드(좁은 화면)를 넓히면',
      shownOn: 'narrow' as const,
      from: 'narrow' as const,
      to: 'wide' as const,
    },
  ])('$label 메뉴를 닫는다', ({ shownOn, from, to }) => {
    const viewport = stubViewport(from);
    const { result } = renderHook(() =>
      useFolderNavHiddenGuard({ shownOn, submitRename: vi.fn() })
    );

    act(() => result.current.setMenuOpen(true));
    viewport.resizeTo(to);

    expect(result.current.menuOpen).toBe(false);
  });

  it('보이는 폭으로 돌아오는 경계에서는 메뉴를 건드리지 않는다', () => {
    const viewport = stubViewport('narrow');
    const { result } = renderHook(() =>
      useFolderNavHiddenGuard({ shownOn: 'wide', submitRename: vi.fn() })
    );

    act(() => result.current.setMenuOpen(true));
    viewport.resizeTo('wide');

    expect(result.current.menuOpen).toBe(true);
  });
});

describe('useFolderNavHiddenGuard — 이름 바꾸기 입력의 포커스가 빠질 때', () => {
  it('보이는 동안에는 저장한다', () => {
    stubViewport('wide');
    const submitRename = vi.fn();
    const { result } = renderHook(() => useFolderNavHiddenGuard({ shownOn: 'wide', submitRename }));

    result.current.handleRenameBlur();

    expect(submitRename).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      label: '사이드바가 좁은 화면에서 숨은 동안',
      shownOn: 'wide' as const,
      from: 'wide' as const,
      to: 'narrow' as const,
    },
    {
      label: '폴더 카드가 넓은 화면에서 숨은 동안',
      shownOn: 'narrow' as const,
      from: 'narrow' as const,
      to: 'wide' as const,
    },
  ])('$label에는 저장하지 않는다', ({ shownOn, from, to }) => {
    const viewport = stubViewport(from);
    const submitRename = vi.fn();
    const { result } = renderHook(() => useFolderNavHiddenGuard({ shownOn, submitRename }));

    viewport.resizeTo(to);
    result.current.handleRenameBlur();

    expect(submitRename).not.toHaveBeenCalled();
  });

  it('원래 폭으로 돌아오면 다시 저장한다', () => {
    const viewport = stubViewport('wide');
    const submitRename = vi.fn();
    const { result } = renderHook(() => useFolderNavHiddenGuard({ shownOn: 'wide', submitRename }));

    viewport.resizeTo('narrow');
    viewport.resizeTo('wide');
    result.current.handleRenameBlur();

    expect(submitRename).toHaveBeenCalledTimes(1);
  });
});
