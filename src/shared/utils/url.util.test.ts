import { describe, expect, it } from 'vitest';
import { UrlUtil } from '@/shared/utils/url.util';

describe('UrlUtil', () => {
  describe('normalizeUrl', () => {
    it('앞뒤 공백을 제거한다', () => {
      expect(UrlUtil.normalizeUrl('  https://example.com  ')).toBe('https://example.com');
    });

    it('중간 공백을 %20으로 치환한다', () => {
      expect(UrlUtil.normalizeUrl('https://example.com/a b')).toBe('https://example.com/a%20b');
    });

    it('쿼리스트링 내 공백도 %20으로 치환한다', () => {
      expect(UrlUtil.normalizeUrl('https://example.com/search?q=1 2')).toBe(
        'https://example.com/search?q=1%202'
      );
    });

    it('탭·개행 문자를 제거한다', () => {
      expect(UrlUtil.normalizeUrl('https://example.com/a\tb')).toBe('https://example.com/ab');
    });

    it('한글은 그대로 보존한다 (java.net.URI가 이미 통과시키므로 인코딩하지 않는다)', () => {
      expect(UrlUtil.normalizeUrl('https://ko.wikipedia.org/wiki/한글')).toBe(
        'https://ko.wikipedia.org/wiki/한글'
      );
    });

    it('공백이 없는 URL은 변화 없이 반환한다', () => {
      expect(UrlUtil.normalizeUrl('https://naver.me/5cAbCd')).toBe('https://naver.me/5cAbCd');
    });

    it('빈 문자열은 빈 문자열을 반환한다', () => {
      expect(UrlUtil.normalizeUrl('')).toBe('');
    });
  });

  describe('toInAppPostPath', () => {
    const POST_ID = '3eedb318-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
    const { protocol, host } = window.location;
    const sameSite = `${protocol}//${host}`;

    it('지금 사이트의 글 상세 주소면 앱 안 경로를 준다', () => {
      expect(UrlUtil.toInAppPostPath(`${sameSite}/post/${POST_ID}`)).toBe(`/post/${POST_ID}`);
    });

    it('끝 슬래시·쿼리·#댓글 조각이 붙어도 글 상세로 보고 쿼리와 조각은 그대로 둔다', () => {
      expect(UrlUtil.toInAppPostPath(`${sameSite}/post/${POST_ID}/`)).toBe(`/post/${POST_ID}/`);
      expect(UrlUtil.toInAppPostPath(`${sameSite}/post/${POST_ID}?from=feed#comment-1`)).toBe(
        `/post/${POST_ID}?from=feed#comment-1`
      );
    });

    it('www.가 붙거나 호스트 대소문자가 달라도 같은 사이트로 본다', () => {
      expect(UrlUtil.toInAppPostPath(`${protocol}//www.${host}/post/${POST_ID}`)).toBe(
        `/post/${POST_ID}`
      );
      expect(UrlUtil.toInAppPostPath(`${protocol}//${host.toUpperCase()}/post/${POST_ID}`)).toBe(
        `/post/${POST_ID}`
      );
    });

    it('다른 사이트의 주소는 같은 모양의 경로여도 null이다', () => {
      expect(UrlUtil.toInAppPostPath(`https://example.com/post/${POST_ID}`)).toBeNull();
    });

    it('글 상세가 아닌 우리 사이트 주소는 null이다', () => {
      expect(UrlUtil.toInAppPostPath(`${sameSite}/post/submit`)).toBeNull();
      expect(UrlUtil.toInAppPostPath(`${sameSite}/post/edit/${POST_ID}`)).toBeNull();
      expect(UrlUtil.toInAppPostPath(`${sameSite}/post/${POST_ID.slice(0, -1)}`)).toBeNull();
      expect(UrlUtil.toInAppPostPath(`${sameSite}/`)).toBeNull();
    });

    it('주소로 읽을 수 없는 문자열은 null이다', () => {
      expect(UrlUtil.toInAppPostPath('not a url')).toBeNull();
    });
  });
});
