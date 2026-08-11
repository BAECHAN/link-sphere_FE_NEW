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
});
