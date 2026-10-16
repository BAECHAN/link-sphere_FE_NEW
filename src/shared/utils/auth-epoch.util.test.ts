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

  describe('토큰이 속한 세대 (client.ts가 요청마다 기억)', () => {
    it('이 탭의 로그인·로그아웃은 토큰 세대도 새 값으로 맞춘다', () => {
      AuthEpochUtil.markLogin();
      expect(AuthEpochUtil.ofToken().stored).toBe(readStored());

      AuthEpochUtil.markLogout();
      expect(AuthEpochUtil.ofToken().stored).toBe(readStored());
    });

    it('다른 탭이 쓴 값은 acknowledge해도 토큰 세대를 바꾸지 않는다 - 새 토큰을 넣을 때(bindToken)만 맞춘다', () => {
      AuthEpochUtil.markLogin();
      const before = AuthEpochUtil.ofToken();
      writeFromOtherTab('in:other-tab');

      AuthEpochUtil.acknowledge();

      expect(AuthEpochUtil.ofToken()).toEqual(before);
      expect(AuthEpochUtil.hasChangedSince(before)).toBe(true);

      AuthEpochUtil.bindToken();

      expect(AuthEpochUtil.ofToken().stored).toBe('in:other-tab');
      expect(AuthEpochUtil.hasChangedSince(AuthEpochUtil.ofToken())).toBe(false);
    });

    it('세대 키가 없는 사용자는 null끼리 같아 바뀌지 않은 것으로 본다', () => {
      expect(AuthEpochUtil.ofToken().stored).toBeNull();
      expect(AuthEpochUtil.hasChangedSince(AuthEpochUtil.ofToken())).toBe(false);
    });

    it('reset은 토큰 세대도 비운다', () => {
      AuthEpochUtil.markLogin();

      AuthEpochUtil.reset();

      expect(AuthEpochUtil.ofToken()).toEqual({ stored: null, inTab: 0 });
    });
  });

  describe('탭 안 세대 (localStorage에 못 쓰는 탭의 같은 탭 계정 전환)', () => {
    it('저장이 실패해도 이 탭의 로그인·로그아웃은 hasChangedSince가 알아챈다 - isStale은 그대로 false', () => {
      AuthEpochUtil.markLogin();
      const before = AuthEpochUtil.ofToken();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      AuthEpochUtil.markLogout();
      AuthEpochUtil.markLogin();

      expect(AuthEpochUtil.ofToken().stored).toBe(before.stored);
      expect(AuthEpochUtil.hasChangedSince(before)).toBe(true);
      expect(AuthEpochUtil.isStale()).toBe(false);
    });

    it('refresh처럼 토큰만 넣고 빼면(bindToken) 탭 안 세대는 그대로다', () => {
      AuthEpochUtil.markLogin();
      const before = AuthEpochUtil.ofToken();

      AuthEpochUtil.bindToken();

      expect(AuthEpochUtil.hasChangedSince(before)).toBe(false);
    });
  });
});
