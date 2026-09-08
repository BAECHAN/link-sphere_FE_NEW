import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageUtil, SessionStorageUtil } from '@/shared/utils/storage.util';

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('LocalStorageUtil', () => {
  it('저장한 객체를 그대로 조회한다 (JSON 라운드트립)', () => {
    LocalStorageUtil.setItem('key', { a: 1, b: '텍스트' });
    expect(LocalStorageUtil.getItem('key')).toEqual({ a: 1, b: '텍스트' });
  });

  it('JSON이 아닌 기존 문자열 값은 원본 그대로 반환한다 (하위 호환)', () => {
    window.localStorage.setItem('legacy-key', 'plain-string-value');
    expect(LocalStorageUtil.getItem('legacy-key')).toBe('plain-string-value');
  });

  it('없는 키는 null을 반환한다', () => {
    expect(LocalStorageUtil.getItem('missing')).toBeNull();
  });

  it('removeItem으로 값을 지운다', () => {
    LocalStorageUtil.setItem('key', 'value');
    LocalStorageUtil.removeItem('key');
    expect(LocalStorageUtil.getItem('key')).toBeNull();
  });

  it('clear로 모든 값을 지운다', () => {
    LocalStorageUtil.setItem('a', 1);
    LocalStorageUtil.setItem('b', 2);
    LocalStorageUtil.clear();
    expect(LocalStorageUtil.getItem('a')).toBeNull();
    expect(LocalStorageUtil.getItem('b')).toBeNull();
  });

  it('storage 접근이 예외를 던져도 크래시하지 않고 null을 반환한다 (Safari 프라이빗 모드 등)', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(LocalStorageUtil.getItem('key')).toBeNull();
  });

  it('setItem 중 예외가 나도 크래시하지 않는다', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => LocalStorageUtil.setItem('key', 'value')).not.toThrow();
  });
});

describe('SessionStorageUtil', () => {
  it('localStorage와 별도로 격리된 스토리지를 사용한다', () => {
    LocalStorageUtil.setItem('shared-key', 'local-value');
    SessionStorageUtil.setItem('shared-key', 'session-value');

    expect(LocalStorageUtil.getItem('shared-key')).toBe('local-value');
    expect(SessionStorageUtil.getItem('shared-key')).toBe('session-value');
  });
});
