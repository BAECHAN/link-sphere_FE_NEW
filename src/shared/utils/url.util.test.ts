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

  describe('splitSharedText', () => {
    it('앞에 장소명·주소가 붙은 공유 문구에서 URL과 나머지 글자를 나눈다(네이버 지도 링크 복사)', () => {
      expect(UrlUtil.splitSharedText('알배기 독막로3길 35 2층 https://naver.me/abc')).toEqual({
        url: 'https://naver.me/abc',
        text: '알배기 독막로3길 35 2층',
      });
    });

    it('줄바꿈이 지워져 글자와 URL이 붙어 있어도 나눈다', () => {
      expect(UrlUtil.splitSharedText('알배기https://naver.me/abc')).toEqual({
        url: 'https://naver.me/abc',
        text: '알배기',
      });
    });

    it('여러 줄·여러 칸 공백은 한 칸으로 줄이고, URL 뒤 글자도 제목 글자에 넣는다', () => {
      expect(
        UrlUtil.splitSharedText('상품명\n  쿠팡  http://link.example.com/a?b=1 에서 확인')
      ).toEqual({
        url: 'http://link.example.com/a?b=1',
        text: '상품명 쿠팡 에서 확인',
      });
    });

    it('URL이 둘 이상이면 첫 URL을 쓰고 나머지는 글자로 둔다', () => {
      expect(UrlUtil.splitSharedText('보기 https://a.com/1 https://b.com/2')).toEqual({
        url: 'https://a.com/1',
        text: '보기 https://b.com/2',
      });
    });

    it('http(s)://로 시작하는 값은 나누지 않는다(공백 낀 URL은 지금처럼 normalizeUrl이 맡는다)', () => {
      expect(UrlUtil.splitSharedText('https://example.com/a b')).toBeNull();
      expect(UrlUtil.splitSharedText('  https://naver.me/abc 알배기')).toBeNull();
    });

    it('http(s):// 주소가 없으면 null이다', () => {
      expect(UrlUtil.splitSharedText('알배기 독막로3길 35 2층')).toBeNull();
      expect(UrlUtil.splitSharedText('주소 ftp://example.com')).toBeNull();
      expect(UrlUtil.splitSharedText('')).toBeNull();
    });
  });
});
