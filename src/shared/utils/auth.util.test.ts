import { describe, expect, it } from 'vitest';
import { AuthUtil } from '@/shared/utils/auth.util';

/** exp(초 단위 UNIX 타임스탬프)를 가진 가짜 JWT를 만든다. payload만 검사 대상이라 서명은 의미 없다. */
function makeToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'none' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

describe('AuthUtil.isTokenExpired', () => {
  it('exp가 충분히 남은 토큰은 false다', () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    expect(AuthUtil.isTokenExpired(makeToken({ exp }))).toBe(false);
  });

  it('exp가 이미 지난 토큰은 true다', () => {
    const exp = Math.floor(Date.now() / 1000) - 10;
    expect(AuthUtil.isTokenExpired(makeToken({ exp }))).toBe(true);
  });

  it('exp까지 30초 미만 남은 토큰은 만료로 취급한다 (여유 마진)', () => {
    const exp = Math.floor(Date.now() / 1000) + 20;
    expect(AuthUtil.isTokenExpired(makeToken({ exp }))).toBe(true);
  });

  it('점(.)이 없는 문자열은 true다', () => {
    expect(AuthUtil.isTokenExpired('not-a-jwt')).toBe(true);
  });

  it('exp가 없는 payload는 true다', () => {
    expect(AuthUtil.isTokenExpired(makeToken({ sub: 'user-1' }))).toBe(true);
  });

  it('base64가 깨진 토큰은 true다', () => {
    expect(AuthUtil.isTokenExpired('header.!!!not-base64!!!.sig')).toBe(true);
  });
});
