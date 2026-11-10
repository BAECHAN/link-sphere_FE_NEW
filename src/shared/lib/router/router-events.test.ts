import { describe, it, expect, vi } from 'vitest';
import { createMemoryRouter } from 'react-router-dom';
import { RouterEvents } from '@/shared/lib/router/router-events';

// 흉내 낸 구독자가 아니라 실제 데이터 라우터를 쓴다 - RouterEvents는 라우터의 router.subscribe(타입 주석에
// "PRIVATE - DO NOT USE"라고 적힌 내부 API)에 기댄다. 라우터를 올려 그 동작이 바뀌면 이 파일이 먼저 깨져야
// 한다(docs/BACK-NAVIGATION.md "위험")
function createInjectedRouter(initialEntries: string[] = ['/post']) {
  const router = createMemoryRouter([{ path: '*', element: null }], { initialEntries });
  RouterEvents.setSource(router);

  return router;
}

describe('RouterEvents', () => {
  it('라우터를 주입하기 전에는 위치가 없다', () => {
    expect(RouterEvents.getLocation()).toBeNull();
  });

  it('주입하면 라우터가 지금 가 있는 위치를 돌려준다', () => {
    createInjectedRouter(['/post?category=dev']);

    expect(RouterEvents.getLocation()).toMatchObject({
      pathname: '/post',
      search: '?category=dev',
    });
  });

  it('push는 navigate를 부른 그 자리에서 구독자에게 닿고, 그때 읽은 위치는 state까지 새 위치다', () => {
    // 뒤로가기로 닫히는 오버레이(useBackClosableOverlay)가 기대는 성질이다 - 탭한 그 작업 안에서 열림이 바뀌어야
    // 오버레이를 그리는 쪽이 페이지 전체보다 먼저 다시 그려진다. loader가 없는 라우트라 가능하다
    const router = createInjectedRouter();
    const statesSeen: unknown[] = [];
    RouterEvents.onNavigate(() => {
      statesSeen.push(RouterEvents.getLocation()?.state);
    });

    void router.navigate('/post', { state: { sheetOpen: true } });

    expect(statesSeen).toEqual([{ sheetOpen: true }]);
  });

  it('replace도 구독자에게 닿는다', async () => {
    const router = createInjectedRouter();
    const onNavigate = vi.fn();
    RouterEvents.onNavigate(onNavigate);

    await router.navigate('/post?category=dev', { replace: true });

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(RouterEvents.getLocation()).toMatchObject({ search: '?category=dev' });
  });

  it('뒤로 가면(pop) 구독자에게 닿고, 읽은 위치는 돌아간 칸이다', async () => {
    const router = createInjectedRouter();
    await router.navigate('/post', { state: { sheetOpen: true } });
    const onNavigate = vi.fn();
    RouterEvents.onNavigate(onNavigate);

    await router.navigate(-1);

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(RouterEvents.getLocation()?.state).toBeNull();
  });

  it('onPop은 뒤로·앞으로 가기에만 불린다', async () => {
    const router = createInjectedRouter();
    const onPop = vi.fn();
    RouterEvents.onPop(onPop);

    await router.navigate('/post/1');
    await router.navigate('/post/2', { replace: true });

    expect(onPop).not.toHaveBeenCalled();

    await router.navigate(-1);

    expect(onPop).toHaveBeenCalledTimes(1);
    expect(onPop).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/post' }));
  });

  it('라우터가 구독자를 불러도 위치가 그대로면 알리지 않는다', () => {
    const router = createInjectedRouter();
    const onRouterStateChange = vi.fn();
    router.subscribe(onRouterStateChange);
    const onNavigate = vi.fn();
    RouterEvents.onNavigate(onNavigate);

    router.revalidate();

    // 라우터는 상태(revalidation)가 바뀌었다고 알렸다 - 아니면 아래 단언이 아무것도 확인하지 못한다
    expect(onRouterStateChange).toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('구독을 해제하면 더 불리지 않는다', async () => {
    const router = createInjectedRouter();
    const onNavigate = vi.fn();
    const unsubscribe = RouterEvents.onNavigate(onNavigate);

    unsubscribe();
    await router.navigate('/post/1');

    expect(onNavigate).not.toHaveBeenCalled();
  });
});
