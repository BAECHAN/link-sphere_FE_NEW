import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chunkReloadKey } from '@/shared/config/storage-keys';

const PATHNAME = '/post';

// "이 페이지에서 새로고침을 걸었다"는 모듈 변수라 테스트마다 모듈을 새로 불러 격리한다
async function loadChunkReloadUtil() {
  vi.resetModules();
  const { ChunkReloadUtil } = await import('@/shared/utils/chunk-reload.util');
  return ChunkReloadUtil;
}

describe('ChunkReloadUtil', () => {
  const reload = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('location', { ...window.location, pathname: PATHNAME, reload });
  });

  afterEach(() => {
    reload.mockReset();
    vi.unstubAllGlobals();
  });

  it('처음 실패하면 경로 키를 기록하고 한 번 새로고침한다', async () => {
    const ChunkReloadUtil = await loadChunkReloadUtil();

    expect(ChunkReloadUtil.reloadOnce()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(chunkReloadKey(PATHNAME))).not.toBeNull();
    expect(ChunkReloadUtil.isReloading()).toBe(true);
  });

  it('같은 페이지에서 다시 실패해도 새로고침을 또 걸지 않고, 시도 소진으로 보지도 않는다', async () => {
    const ChunkReloadUtil = await loadChunkReloadUtil();

    ChunkReloadUtil.reloadOnce();

    expect(ChunkReloadUtil.reloadOnce()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(ChunkReloadUtil.hasRetried()).toBe(false);
  });

  it('이전 로드에서 이미 시도한 경로면 새로고침하지 않는다', async () => {
    sessionStorage.setItem(chunkReloadKey(PATHNAME), '1');
    const ChunkReloadUtil = await loadChunkReloadUtil();

    expect(ChunkReloadUtil.hasRetried()).toBe(true);
    expect(ChunkReloadUtil.reloadOnce()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('다른 경로의 기록은 이 경로의 시도로 치지 않는다', async () => {
    sessionStorage.setItem(chunkReloadKey('/bookmark'), '1');
    const ChunkReloadUtil = await loadChunkReloadUtil();

    expect(ChunkReloadUtil.hasRetried()).toBe(false);
    expect(ChunkReloadUtil.reloadOnce()).toBe(true);
  });

  it('저장소에 기록할 수 없으면 루프 가드가 없으므로 새로고침하지 않는다', async () => {
    const ChunkReloadUtil = await loadChunkReloadUtil();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(ChunkReloadUtil.reloadOnce()).toBe(false);
    expect(reload).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
