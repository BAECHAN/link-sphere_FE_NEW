import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { useDeployedBuildInfo } from '@/shared/hooks/useDeployedBuildInfo';

const VALID_BUILD_INFO = {
  sha: 'abc1234',
  ref: 'main',
  mode: 'production',
  runNumber: '42',
  runId: '1234567890',
  builtAt: '2026-09-20T06:55:48.340Z',
};

const DEPLOYED_ENTRY_SRC = '/assets/js/index-deployed.js';

/** MSW 핸들러가 실제로 호출됐는지 알아야 "요청을 보내지 않았다"를 안전하게 검증할 수 있다. */
function mockVersionJson(body: typeof VALID_BUILD_INFO) {
  const handlerCalled = vi.fn();
  server.use(
    http.get('*/version.json', () => {
      handlerCalled();
      return HttpResponse.json(body);
    })
  );
  return handlerCalled;
}

/** VersionUtil.fetchDeployedEntryScriptSrc가 내부적으로 GET /index.html을 부른다 -
 * 목킹 없이 두면 onUnhandledRequest: 'warn' 설정 때문에 실제 네트워크로 새어나간다. */
function mockIndexHtml(entrySrc: string) {
  server.use(
    http.get(
      '*/index.html',
      () =>
        new HttpResponse(
          `<html><head><script type="module" src="${entrySrc}"></script></head></html>`,
          { headers: { 'Content-Type': 'text/html' } }
        )
    )
  );
}

describe('useDeployedBuildInfo', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', false);
    mockIndexHtml(DEPLOYED_ENTRY_SRC);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('마운트 시 1회 조회해 빌드 정보와 entry script를 함께 상태에 반영한다', async () => {
    mockVersionJson(VALID_BUILD_INFO);

    const { result } = renderHook(() => useDeployedBuildInfo());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.deployedBuildInfo).toEqual(VALID_BUILD_INFO);
    });
    expect(result.current.deployedEntryScript).toBe(DEPLOYED_ENTRY_SRC);
    expect(result.current.isLoading).toBe(false);
  });

  it('DEV 모드면 fetch 자체를 하지 않는다', async () => {
    vi.stubEnv('DEV', true);
    const handlerCalled = mockVersionJson(VALID_BUILD_INFO);

    const { result } = renderHook(() => useDeployedBuildInfo());

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handlerCalled).not.toHaveBeenCalled();
    expect(result.current.deployedBuildInfo).toBeNull();
    expect(result.current.deployedEntryScript).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('버전 조회 실패 시 entry script는 받아오더라도 deployedBuildInfo는 null을 유지한다', async () => {
    server.use(http.get('*/version.json', () => HttpResponse.error()));

    const { result } = renderHook(() => useDeployedBuildInfo());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.deployedBuildInfo).toBeNull();
    expect(result.current.deployedEntryScript).toBe(DEPLOYED_ENTRY_SRC);
  });

  it('entry script 조회 실패 시 deployedBuildInfo는 받아오더라도 entry script는 null을 유지한다', async () => {
    server.use(http.get('*/index.html', () => HttpResponse.error()));
    mockVersionJson(VALID_BUILD_INFO);

    const { result } = renderHook(() => useDeployedBuildInfo());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.deployedBuildInfo).toEqual(VALID_BUILD_INFO);
    expect(result.current.deployedEntryScript).toBeNull();
  });
});
