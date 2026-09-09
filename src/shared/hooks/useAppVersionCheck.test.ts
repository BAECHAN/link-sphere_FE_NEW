import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { useAppVersionCheck, VERSION_CHECK_THROTTLE_MS } from '@/shared/hooks/useAppVersionCheck';
import { useAppVersionStore } from '@/shared/store/appVersion.store';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

const CURRENT_SRC = '/assets/js/index-current.js';
const NEW_SRC = '/assets/js/index-new.js';

/** MSW 핸들러가 실제로 호출됐는지 알아야 "아무 일도 안 일어남"을 안전하게 검증할 수 있다 -
 * 콜백이 비동기 fetch 체인 끝에서 store를 갱신하므로, 핸들러 호출 후 한 틱을 더 흘려보낸다. */
function mockDeployedIndexHtml(entrySrc: string) {
  const handlerCalled = vi.fn();
  server.use(
    http.get('*/index.html', () => {
      handlerCalled();
      return new HttpResponse(
        `<html><head><script type="module" src="${entrySrc}"></script></head></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    })
  );
  return handlerCalled;
}

function dispatchFocus() {
  window.dispatchEvent(new Event('focus'));
}

// setTimeout은 실제(real) 타이머로 남긴다 - MSW의 네트워크 응답과 vi.waitFor의 폴링이 여기 의존한다.
// Date만 페이크해서 "마운트 직후 첫 focus는 쓰로틀에 걸린다"는 실제 정책을 우회한다 -
// 그렇지 않으면 renderHook 직후 dispatchFocus는 항상 쓰로틀에 막혀 fetch가 발생하지 않는다.
function advancePastThrottle() {
  vi.setSystemTime(Date.now() + VERSION_CHECK_THROTTLE_MS + 1000);
}

async function flushFetchChain() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useAppVersionCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.stubEnv('DEV', false);
    useAppVersionStore.setState({ detectedAtPathname: null });
    sessionStorage.clear();

    document.head.innerHTML = `<script type="module" src="${CURRENT_SRC}"></script>`;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    document.head.innerHTML = '';
  });

  it('DEV 모드면 focus 리스너 자체를 등록하지 않는다', async () => {
    vi.stubEnv('DEV', true);
    const handlerCalled = mockDeployedIndexHtml(NEW_SRC);
    renderHook(() => useAppVersionCheck());

    advancePastThrottle();
    dispatchFocus();
    await flushFetchChain();

    expect(handlerCalled).not.toHaveBeenCalled();
    expect(useAppVersionStore.getState().detectedAtPathname).toBeNull();
  });

  it('마운트 직후 첫 focus는 쓰로틀에 걸려 fetch하지 않는다', async () => {
    const handlerCalled = mockDeployedIndexHtml(NEW_SRC);
    renderHook(() => useAppVersionCheck());

    dispatchFocus();
    await flushFetchChain();

    expect(handlerCalled).not.toHaveBeenCalled();
  });

  it('배포된 해시가 같으면 플래그를 세우지 않는다', async () => {
    const handlerCalled = mockDeployedIndexHtml(CURRENT_SRC);
    renderHook(() => useAppVersionCheck());

    advancePastThrottle();
    dispatchFocus();
    await vi.waitFor(() => expect(handlerCalled).toHaveBeenCalled());
    await flushFetchChain();

    expect(useAppVersionStore.getState().detectedAtPathname).toBeNull();
  });

  it('배포된 해시가 다르면 플래그를 세우고 sessionStorage에 기록한다', async () => {
    mockDeployedIndexHtml(NEW_SRC);
    renderHook(() => useAppVersionCheck());

    advancePastThrottle();
    dispatchFocus();

    await vi.waitFor(() => {
      expect(useAppVersionStore.getState().detectedAtPathname).toBe('/');
    });
    expect(sessionStorage.getItem(STORAGE_KEYS.VERSION.LAST_DETECTED)).toBe(
      JSON.stringify(NEW_SRC)
    );
  });

  it('쓰로틀 시간 내 연속 focus는 fetch를 한 번만 보낸다', async () => {
    const handlerCalled = mockDeployedIndexHtml(NEW_SRC);
    renderHook(() => useAppVersionCheck());

    advancePastThrottle();
    dispatchFocus();
    dispatchFocus();
    dispatchFocus();

    await vi.waitFor(() => {
      expect(useAppVersionStore.getState().detectedAtPathname).toBe('/');
    });
    expect(handlerCalled).toHaveBeenCalledTimes(1);
  });

  it('같은 값으로 이미 감지된 적 있으면 다시 플래그를 세우지 않는다 (리로드 루프 가드)', async () => {
    sessionStorage.setItem(STORAGE_KEYS.VERSION.LAST_DETECTED, JSON.stringify(NEW_SRC));
    const handlerCalled = mockDeployedIndexHtml(NEW_SRC);
    renderHook(() => useAppVersionCheck());

    advancePastThrottle();
    dispatchFocus();
    await vi.waitFor(() => expect(handlerCalled).toHaveBeenCalled());
    await flushFetchChain();

    expect(useAppVersionStore.getState().detectedAtPathname).toBeNull();
  });

  it('index.html fetch가 실패해도 조용히 종료한다', async () => {
    const handlerCalled = vi.fn();
    server.use(
      http.get('*/index.html', () => {
        handlerCalled();
        return HttpResponse.error();
      })
    );
    renderHook(() => useAppVersionCheck());

    advancePastThrottle();
    dispatchFocus();
    await vi.waitFor(() => expect(handlerCalled).toHaveBeenCalled());
    await flushFetchChain();

    expect(useAppVersionStore.getState().detectedAtPathname).toBeNull();
  });
});
