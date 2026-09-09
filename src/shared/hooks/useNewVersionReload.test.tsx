import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { useNewVersionReload } from '@/shared/hooks/useNewVersionReload';
import { useAppVersionStore } from '@/shared/store/appVersion.store';

const reloadSpy = vi.fn();

// jsdom은 location.reload를 구현하지 않아 호출 시 "Not implemented" 경고를 남긴다 -
// 이 테스트 파일 안에서만 스텁한다(전역 setup.ts에 두면 다른 테스트를 오염시킨다).
Object.defineProperty(window, 'location', {
  value: { ...window.location, reload: reloadSpy },
  writable: true,
  configurable: true,
});

let latestShouldReload = false;

function TestComponent() {
  latestShouldReload = useNewVersionReload();
  return null;
}

const routes: RouteObject[] = [{ path: '*', element: <TestComponent /> }];

function renderAtPath(initialPath: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('useNewVersionReload', () => {
  beforeEach(() => {
    reloadSpy.mockClear();
    latestShouldReload = false;
    useAppVersionStore.setState({ detectedAtPathname: null });
  });

  it('플래그가 없으면 라우트를 이동해도 리로드하지 않는다', async () => {
    const router = renderAtPath('/post');

    await act(async () => router.navigate('/bookmark'));

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(latestShouldReload).toBe(false);
  });

  it('플래그가 감지 시점 pathname 그대로면 리로드하지 않는다', () => {
    useAppVersionStore.setState({ detectedAtPathname: '/post' });
    renderAtPath('/post');

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(latestShouldReload).toBe(false);
  });

  it('플래그가 있는 상태에서 pathname이 바뀌면 정확히 1회 리로드한다', async () => {
    useAppVersionStore.setState({ detectedAtPathname: '/post' });
    const router = renderAtPath('/post');

    await act(async () => router.navigate('/bookmark'));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(latestShouldReload).toBe(true);
  });

  it('쿼리스트링만 바뀌면 리로드하지 않는다 (북마크 폴더 전환 회귀 방지)', async () => {
    useAppVersionStore.setState({ detectedAtPathname: '/bookmark' });
    const router = renderAtPath('/bookmark');

    await act(async () => router.navigate('/bookmark?folder=abc'));

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(latestShouldReload).toBe(false);
  });
});
