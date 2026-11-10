import { describe, it, expect, vi } from 'vitest';
import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { useLocation } from 'react-router-dom';
import { act, renderWithDataRouter, screen, userEvent } from '@/test/utils';
import {
  useBackClosableOverlay,
  useBackClosableOverlayOpen,
  useBackClosableOverlayOpenReplacingCurrent,
} from '@/shared/hooks/useBackClosableOverlay';

const KEY = 'bookmarkFolderDialogOpen';

// 앞에 다른 페이지를 한 칸 둔다 - 뒤로가 한 번 더 나가면 /feed로 넘어가 드러난다
const ENTRIES_WITH_PREVIOUS_PAGE = ['/feed', '/post/1?tab=comments'];

// navigate를 모킹하지 않고 실제 라우터(renderWithDataRouter)의 위치로 본다 - 열림이 라우터 위치에서 나오므로
// 모킹하면 "열었더니 열렸다"를 확인할 수 없다
function Host() {
  const { isOpen, open, close } = useBackClosableOverlay(KEY);

  return (
    <>
      <span data-testid="host">{isOpen ? 'open' : 'closed'}</span>
      <button type="button" onClick={open}>
        open
      </button>
      <button
        type="button"
        onClick={() => {
          open();
          open();
        }}
      >
        open twice
      </button>
      <button type="button" onClick={close}>
        close
      </button>
      <button
        type="button"
        onClick={() => {
          close();
          close();
        }}
      >
        close twice
      </button>
    </>
  );
}

function Opener({ onCommit }: { onCommit: () => void }) {
  const open = useBackClosableOverlayOpen(KEY);

  // 의존성 없이 둬 이 컴포넌트가 커밋될 때마다 센다
  useEffect(() => {
    onCommit();
  });

  return (
    <button type="button" onClick={open}>
      open from card
    </button>
  );
}

const NeverLoads = lazy(() => new Promise<{ default: ComponentType }>(() => {}));

// 열림 키가 실린 위치를 그리려 하면 끝나지 않는 페이지 - 목록 응답을 기다리는 화면(정지 구간)을 흉내 낸다
function PageSuspendingOnOverlayEntry() {
  const location = useLocation();
  const hasOverlayEntry = Boolean((location.state as Record<string, boolean> | null)?.[KEY]);

  return (
    <>
      <span data-testid="committed">{hasOverlayEntry ? 'overlay entry' : 'page entry'}</span>
      {hasOverlayEntry && <NeverLoads />}
    </>
  );
}

function ScreenWithSuspendingPage({ onOpenerCommit }: { onOpenerCommit: () => void }) {
  return (
    <>
      <Suspense fallback={<span data-testid="fallback" />}>
        <PageSuspendingOnOverlayEntry />
      </Suspense>
      <Opener onCommit={onOpenerCommit} />
      <Host />
    </>
  );
}

async function click(name: string) {
  await userEvent.click(screen.getByRole('button', { name }));
}

describe('useBackClosableOverlay', () => {
  it('열면 같은 주소에 열림 키를 실은 칸을 넣는다', async () => {
    const { router } = renderWithDataRouter(<Host />, {
      wrapperOptions: { initialEntries: ENTRIES_WITH_PREVIOUS_PAGE },
    });

    await click('open');

    expect(screen.getByTestId('host')).toHaveTextContent('open');
    expect(router.state.historyAction).toBe('PUSH');
    expect(router.state.location).toMatchObject({
      pathname: '/post/1',
      search: '?tab=comments',
      state: { [KEY]: true },
    });
    // 이게 없으면 <ScrollRestoration/>이 PUSH를 새 페이지로 보고 배경 스크롤을 맨 위로 올린다
    expect(router.state.preventScrollReset).toBe(true);
  });

  it('한 번에 두 번 열어도, 열린 뒤 다시 열어도 칸은 하나다', async () => {
    // 칸이 둘이면 닫기를 두 번 눌러야 닫힌다. 첫 번째 열기가 화면에 반영되기 전의 두 번째 탭도 막아야 한다 -
    // 커밋된 위치로 판정하면 그 탭이 지나간다
    const { router } = renderWithDataRouter(<Host />, {
      wrapperOptions: { initialEntries: ENTRIES_WITH_PREVIOUS_PAGE },
    });

    await click('open twice');
    await click('open');
    await act(() => router.navigate(-1));

    expect(screen.getByTestId('host')).toHaveTextContent('closed');
    expect(router.state.location).toMatchObject({ pathname: '/post/1', state: null });
  });

  it('닫으면 뒤로 한 번만 간다 - 한 번에 두 번 닫아도 페이지를 떠나지 않는다', async () => {
    // navigate(-1)은 늦게 반영된다 - 그 사이 닫기가 또 불리면(Esc 조합 중 keydown 중복) 뒤로가 두 번 나간다
    const { router } = renderWithDataRouter(<Host />, {
      wrapperOptions: { initialEntries: ENTRIES_WITH_PREVIOUS_PAGE },
    });

    await click('open');
    await click('close twice');

    expect(screen.getByTestId('host')).toHaveTextContent('closed');
    expect(router.state.location).toMatchObject({ pathname: '/post/1', state: null });
  });

  it('닫혀 있을 때 닫기는 아무것도 하지 않는다', async () => {
    // 칸이 없는데 뒤로를 보내면 실제 페이지를 떠난다
    const { router } = renderWithDataRouter(<Host />, {
      wrapperOptions: { initialEntries: ENTRIES_WITH_PREVIOUS_PAGE },
    });

    await click('close');

    expect(router.state.location.pathname).toBe('/post/1');
  });

  it('뒤로가기로 칸이 빠지면 닫힌다', async () => {
    const { router } = renderWithDataRouter(<Host />);

    await click('open');
    await act(() => router.navigate(-1));

    expect(screen.getByTestId('host')).toHaveTextContent('closed');
  });

  it('닫은 뒤 앞으로 가기로 다시 열린 칸도 닫을 수 있다', async () => {
    // 같은 칸이라 location.key가 같다 - 뒤로를 보낸 칸을 key로 기억하면 여기서 닫기가 먹지 않는다
    const { router } = renderWithDataRouter(<Host />, {
      wrapperOptions: { initialEntries: ENTRIES_WITH_PREVIOUS_PAGE },
    });

    await click('open');
    await click('close');
    await act(() => router.navigate(1));

    expect(screen.getByTestId('host')).toHaveTextContent('open');

    await click('close');

    expect(screen.getByTestId('host')).toHaveTextContent('closed');
    expect(router.state.location).toMatchObject({ pathname: '/post/1', state: null });
  });

  it('페이지를 다시 그리는 일이 끝나지 않아도 오버레이는 먼저 열린다', async () => {
    // 칸을 넣으면 React Router가 페이지 전체를 transition으로 다시 그린다(v7_startTransition). 열림을 커밋된
    // 위치(useLocation)에서 읽으면 그 렌더가 끝나야 열린다 - 라우터가 가 있는 위치에서 읽어 먼저 연다
    const { router } = renderWithDataRouter(<ScreenWithSuspendingPage onOpenerCommit={vi.fn()} />);

    await click('open');

    expect(screen.getByTestId('host')).toHaveTextContent('open');
    expect(router.state.location.state).toEqual({ [KEY]: true });
    // 페이지는 아직 이전 위치로 그려져 있고, 로딩 화면으로 바뀌지도 않았다
    expect(screen.getByTestId('committed')).toHaveTextContent('page entry');
    expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
  });
});

describe('useBackClosableOverlayOpen', () => {
  it('열기만 해도 그리는 쪽(useBackClosableOverlay)이 열린다', async () => {
    renderWithDataRouter(
      <>
        <Opener onCommit={vi.fn()} />
        <Host />
      </>
    );

    await click('open from card');

    expect(screen.getByTestId('host')).toHaveTextContent('open');
  });

  it('열림을 구독하지 않아, 오버레이를 먼저 그리는 렌더에 끼지 않는다', async () => {
    // 피드 카드마다 이 훅을 쓴다 - 구독하면 시트를 여는 그 렌더에 모든 카드가 함께 그려진다. 페이지를 다시 그리는
    // transition에는 들어가므로(useNavigate가 읽는 RouteContext가 위치마다 새 값이다), 그 transition이 끝나지
    // 않는 화면에서 커밋 수를 센다
    const onOpenerCommit = vi.fn();
    renderWithDataRouter(<ScreenWithSuspendingPage onOpenerCommit={onOpenerCommit} />);

    await click('open from card');

    expect(screen.getByTestId('host')).toHaveTextContent('open');
    expect(onOpenerCommit).toHaveBeenCalledTimes(1);
  });
});

describe('useBackClosableOverlayOpenReplacingCurrent', () => {
  function MenuWithSignInLink() {
    const { isOpen: isMenuOpen } = useBackClosableOverlay('sidebarOpen');
    const { isOpen: isSignInOpen } = useBackClosableOverlay('loginDialogOpen');
    const openSignInReplacingMenu = useBackClosableOverlayOpenReplacingCurrent('loginDialogOpen');

    return (
      <>
        <span data-testid="menu">{isMenuOpen ? 'open' : 'closed'}</span>
        <span data-testid="sign-in">{isSignInOpen ? 'open' : 'closed'}</span>
        <button
          type="button"
          onClick={() => {
            openSignInReplacingMenu();
            openSignInReplacingMenu();
          }}
        >
          sign in from menu
        </button>
      </>
    );
  }

  it('지금 칸을 이 오버레이의 칸으로 바꾼다 - 두 번 불려도 칸이 늘지 않는다', async () => {
    // 폰 메뉴에서 로그인 창을 이어 열 때 쓴다 - 메뉴 칸을 남기면 창을 닫은 뒤 메뉴가 다시 열린다
    const { router } = renderWithDataRouter(<MenuWithSignInLink />, {
      wrapperOptions: {
        initialEntries: [
          '/feed',
          { pathname: '/post/1', search: '?tab=comments', state: { sidebarOpen: true } },
        ],
      },
    });

    expect(screen.getByTestId('menu')).toHaveTextContent('open');

    await click('sign in from menu');

    expect(screen.getByTestId('menu')).toHaveTextContent('closed');
    expect(screen.getByTestId('sign-in')).toHaveTextContent('open');
    expect(router.state.historyAction).toBe('REPLACE');
    expect(router.state.location).toMatchObject({
      pathname: '/post/1',
      search: '?tab=comments',
      state: { loginDialogOpen: true },
    });
    // 이게 없으면 <ScrollRestoration/>이 이 이동을 새 페이지로 보고 배경 스크롤을 맨 위로 올린다
    expect(router.state.preventScrollReset).toBe(true);

    // 칸이 그대로 하나라, 뒤로 한 번에 메뉴를 거치지 않고 앞 페이지로 간다
    await act(() => router.navigate(-1));

    expect(router.state.location.pathname).toBe('/feed');
  });
});
