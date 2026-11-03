import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, NavigationType, type Location } from 'react-router-dom';
import type { ReactNode } from 'react';
import { RouterEvents } from '@/shared/lib/router/router-events';
import {
  resetBackClosableOverlay,
  useBackClosableOverlay,
} from '@/shared/hooks/useBackClosableOverlay';

const navigateSpy = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

// jsdom에는 CloseWatcher가 없어 만든 것·정리한 것만 기록하는 가짜를 넣는다
const watchers: FakeCloseWatcher[] = [];

class FakeCloseWatcher {
  onclose: (() => void) | null = null;
  destroyed = false;

  constructor() {
    watchers.push(this);
  }

  destroy() {
    this.destroyed = true;
  }
}

function setUpDevice({
  closeWatcher,
  coarsePointer,
}: {
  closeWatcher: boolean;
  coarsePointer: boolean;
}) {
  if (closeWatcher) {
    window.CloseWatcher = FakeCloseWatcher;
  }

  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: coarsePointer && query === '(pointer: coarse)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function makeLocation(pathname: string, key: string): Location {
  return { pathname, search: '', hash: '', state: null, key };
}

// 앱은 RouterProvider.tsx가 라우터를 주입한다 - 테스트는 구독자를 잡아 두고 이동을 직접 흘린다
function injectRouter() {
  let subscriber: ((state: { location: Location; historyAction: NavigationType }) => void) | null =
    null;

  RouterEvents.setSource({
    state: { location: makeLocation('/post/1', 'initial') },
    subscribe: (next) => {
      subscriber = next;

      return () => {};
    },
  });

  return (pathname: string) => {
    subscriber?.({
      location: makeLocation(pathname, pathname),
      historyAction: NavigationType.Push,
    });
  };
}

function Wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={['/post/1']}>{children}</MemoryRouter>;
}

describe('useBackClosableOverlay', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
  });

  afterEach(() => {
    resetBackClosableOverlay();
    delete window.CloseWatcher;
    watchers.length = 0;
    vi.restoreAllMocks();
  });

  it('CloseWatcher가 없으면(iOS 등) 히스토리 엔트리로 연다', () => {
    const { result } = renderHook(() => useBackClosableOverlay('bookmarkFolderDialogOpen:1'), {
      wrapper: Wrapper,
    });

    result.current.open();

    expect(navigateSpy).toHaveBeenCalledWith('/post/1', {
      state: { 'bookmarkFolderDialogOpen:1': true },
      preventScrollReset: true,
    });
  });

  it('CloseWatcher가 있어도 터치가 주 입력이 아니면(데스크톱) 히스토리 엔트리로 연다', () => {
    // 데스크톱 브라우저 뒤로가기는 닫기 요청이 아니라 엔트리가 있어야 모달만 닫힌다
    setUpDevice({ closeWatcher: true, coarsePointer: false });
    const { result } = renderHook(() => useBackClosableOverlay('bookmarkFolderDialogOpen:1'), {
      wrapper: Wrapper,
    });

    result.current.open();

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(watchers).toHaveLength(0);
  });

  describe('뒤로가기가 닫기 요청인 기기(CloseWatcher + 터치)', () => {
    beforeEach(() => {
      setUpDevice({ closeWatcher: true, coarsePointer: true });
    });

    it('히스토리 없이 열고, 열려 있는 동안 CloseWatcher를 둔다', () => {
      const { result } = renderHook(() => useBackClosableOverlay('bookmarkFolderDialogOpen:1'), {
        wrapper: Wrapper,
      });

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
      expect(navigateSpy).not.toHaveBeenCalled();
      expect(watchers).toHaveLength(1);
      expect(watchers[0]?.destroyed).toBe(false);
    });

    it('뒤로가기(닫기 요청)가 오면 닫고 CloseWatcher를 정리한다', () => {
      const { result } = renderHook(() => useBackClosableOverlay('bookmarkFolderDialogOpen:1'), {
        wrapper: Wrapper,
      });

      act(() => {
        result.current.open();
      });
      act(() => {
        watchers[0]?.onclose?.();
      });

      expect(result.current.isOpen).toBe(false);
      expect(watchers[0]?.destroyed).toBe(true);
    });

    it('X·폴더 선택으로 닫아도 CloseWatcher를 정리한다', () => {
      // watcher가 남으면 보이지 않는 모달이 다음 뒤로가기를 삼킨다
      const { result } = renderHook(() => useBackClosableOverlay('bookmarkFolderDialogOpen:1'), {
        wrapper: Wrapper,
      });

      act(() => {
        result.current.open();
      });
      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
      expect(watchers[0]?.destroyed).toBe(true);
    });

    it('다른 카드(다른 키)의 모달은 같이 열리지 않는다', () => {
      const { result } = renderHook(
        () => ({
          first: useBackClosableOverlay('bookmarkFolderDialogOpen:1'),
          second: useBackClosableOverlay('bookmarkFolderDialogOpen:2'),
        }),
        { wrapper: Wrapper }
      );

      act(() => {
        result.current.first.open();
      });

      expect(result.current.first.isOpen).toBe(true);
      expect(result.current.second.isOpen).toBe(false);
    });

    it('카드가 다시 마운트돼도(화면 회전·목록 밀림) 열린 채로 남는다', () => {
      const first = renderHook(() => useBackClosableOverlay('bookmarkFolderDialogOpen:1'), {
        wrapper: Wrapper,
      });

      act(() => {
        first.result.current.open();
      });
      first.unmount();

      expect(watchers[0]?.destroyed).toBe(true);

      const second = renderHook(() => useBackClosableOverlay('bookmarkFolderDialogOpen:1'), {
        wrapper: Wrapper,
      });

      expect(second.result.current.isOpen).toBe(true);
      expect(watchers).toHaveLength(2);
      expect(watchers[1]?.destroyed).toBe(false);
    });

    it('다른 이유로 페이지가 바뀌면 닫는다 — 카드가 사라진 뒤에도', () => {
      // 닫지 않으면 그 화면으로 돌아왔을 때 모달만 다시 뜬다
      const navigateTo = injectRouter();
      const first = renderHook(() => useBackClosableOverlay('bookmarkFolderDialogOpen:1'), {
        wrapper: Wrapper,
      });

      act(() => {
        first.result.current.open();
      });
      first.unmount();
      navigateTo('/bookmark');

      const second = renderHook(() => useBackClosableOverlay('bookmarkFolderDialogOpen:1'), {
        wrapper: Wrapper,
      });

      expect(second.result.current.isOpen).toBe(false);
    });

    it('카드가 떠 있을 때 페이지가 바뀌어도 닫고 CloseWatcher를 정리한다', () => {
      const navigateTo = injectRouter();
      const { result } = renderHook(() => useBackClosableOverlay('bookmarkFolderDialogOpen:1'), {
        wrapper: Wrapper,
      });

      act(() => {
        result.current.open();
      });
      act(() => {
        navigateTo('/bookmark');
      });

      expect(result.current.isOpen).toBe(false);
      expect(watchers[0]?.destroyed).toBe(true);
    });

    it('로그인 창이 열렸다 닫힌 뒤 재개로 열면 그 이동들로 닫히지 않는다 — 카드가 다시 마운트됐어도', () => {
      // useLoginDialog.ts는 로그인 창의 navigate(-1)이 커밋된 뒤(isOpen=false) 재개 액션을 부르고,
      // RouterEvents는 커밋 전에 이동을 알린다 - 재개 때는 로그인 창의 push·pop이 이미 지나가 있다
      const navigateTo = injectRouter();
      const first = renderHook(() => useBackClosableOverlay('bookmarkFolderDialogOpen:1'), {
        wrapper: Wrapper,
      });
      const resume = first.result.current.open;

      navigateTo('/post/1');
      navigateTo('/post/1');
      first.unmount();

      const second = renderHook(() => useBackClosableOverlay('bookmarkFolderDialogOpen:1'), {
        wrapper: Wrapper,
      });

      act(() => {
        resume();
      });

      expect(second.result.current.isOpen).toBe(true);
      expect(watchers).toHaveLength(1);
      expect(watchers[0]?.destroyed).toBe(false);
    });
  });
});
