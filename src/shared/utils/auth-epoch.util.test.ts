import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { AuthEpochUtil } from '@/shared/utils/auth-epoch.util';
import { LocalStorageUtil } from '@/shared/utils/storage.util';

const readStored = () => LocalStorageUtil.getItem<string>(STORAGE_KEYS.AUTH.EPOCH);

// 다른 탭이 같은 localStorage에 값을 쓴 상황
const writeFromOtherTab = (value: string) =>
  LocalStorageUtil.setItem(STORAGE_KEYS.AUTH.EPOCH, value);

describe('AuthEpochUtil', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('이 탭의 로그인·로그아웃은 in:/out: 값을 쓰고, 이 탭 기준으로는 바뀐 게 아니다', () => {
    AuthEpochUtil.markLogin();
    expect(readStored()).toMatch(/^in:/);
    expect(AuthEpochUtil.isLoginEpoch()).toBe(true);
    expect(AuthEpochUtil.isStale()).toBe(false);

    AuthEpochUtil.markLogout();
    expect(readStored()).toMatch(/^out:/);
    expect(AuthEpochUtil.isLoginEpoch()).toBe(false);
    expect(AuthEpochUtil.isStale()).toBe(false);
  });

  it('로그인할 때마다 다른 값이다 - 같은 계정으로 다시 로그인해도 다른 탭이 알아챈다', () => {
    AuthEpochUtil.markLogin();
    const first = readStored();
    AuthEpochUtil.markLogin();

    expect(readStored()).not.toBe(first);
  });

  it('다른 탭이 쓴 값은 바뀐 것으로 보고, acknowledge 뒤에는 같은 것으로 본다', () => {
    AuthEpochUtil.markLogin();
    writeFromOtherTab('out:other-tab');

    expect(AuthEpochUtil.isStale()).toBe(true);

    AuthEpochUtil.acknowledge();

    expect(AuthEpochUtil.isStale()).toBe(false);
  });

  it('저장이 실패해도 이 탭을 바뀐 것으로 오판하지 않는다 - 메모리를 다시 읽은 저장값에 맞춘다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    AuthEpochUtil.markLogin();

    expect(readStored()).toBeNull();
    expect(AuthEpochUtil.isStale()).toBe(false);
  });
});
