import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DateUtil } from '@/shared/utils/date.util';

describe('DateUtil', () => {
  describe('isValid', () => {
    it('유효한 날짜 문자열에 대해 true를 반환한다', () => {
      expect(DateUtil.isValid('2025-01-01')).toBe(true);
    });

    it('유효하지 않은 날짜 문자열에 대해 false를 반환한다', () => {
      expect(DateUtil.isValid('not-a-date')).toBe(false);
    });

    it('null에 대해 false를 반환한다', () => {
      expect(DateUtil.isValid(null)).toBe(false);
    });
  });

  describe('formatDefault', () => {
    it('날짜를 YYYY-MM-DD 형식으로 반환한다', () => {
      const result = DateUtil.formatDefault(new Date('2025-03-15T00:00:00.000Z'));
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('null에 대해 빈 문자열을 반환한다', () => {
      expect(DateUtil.formatDefault(null)).toBe('');
    });

    it('undefined에 대해 빈 문자열을 반환하지 않는다 (현재 시각 반환)', () => {
      // undefined는 현재 시각으로 처리됨
      const result = DateUtil.formatDefault(undefined);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('formatRelativeShort', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // 기준 시간: 2025-03-01T12:00:00Z (서울 기준: 2025-03-01T21:00:00+09:00)
      vi.setSystemTime(new Date('2025-03-01T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('1분 미만이면 "방금 전"을 반환한다', () => {
      const thirtySecondsAgo = new Date('2025-03-01T11:59:30.000Z');
      expect(DateUtil.formatRelativeShort(thirtySecondsAgo)).toBe('방금 전');
    });

    it('60분 미만이면 "X분 전"을 반환한다', () => {
      const thirtyMinutesAgo = new Date('2025-03-01T11:30:00.000Z');
      expect(DateUtil.formatRelativeShort(thirtyMinutesAgo)).toBe('30분 전');
    });

    it('24시간 미만이면 "X시간 전"을 반환한다', () => {
      const twoHoursAgo = new Date('2025-03-01T10:00:00.000Z');
      expect(DateUtil.formatRelativeShort(twoHoursAgo)).toBe('2시간 전');
    });

    it('7일 미만이면 "X일 전"을 반환한다', () => {
      const threeDaysAgo = new Date('2025-02-26T12:00:00.000Z');
      expect(DateUtil.formatRelativeShort(threeDaysAgo)).toBe('3일 전');
    });

    it('유효하지 않은 날짜에 대해 빈 문자열을 반환한다', () => {
      expect(DateUtil.formatRelativeShort('invalid')).toBe('');
    });
  });

  describe('formatKorean', () => {
    it('날짜를 "YYYY년 M월 D일" 형식으로 반환한다', () => {
      // 2025-06-15T00:00:00Z → 서울 기준 2025-06-15T09:00:00+09:00
      const result = DateUtil.formatKorean(new Date('2025-06-15T00:00:00.000Z'));
      expect(result).toContain('2025년');
      expect(result).toContain('월');
      expect(result).toContain('일');
    });
  });

  describe('formatDateRange', () => {
    it('시작일과 종료일을 " ~ "로 연결한다', () => {
      const start = new Date('2025-01-01T00:00:00.000Z');
      const end = new Date('2025-01-31T00:00:00.000Z');
      const result = DateUtil.formatDateRange(start, end);
      expect(result).toContain(' ~ ');
    });

    it('두 날짜 모두 유효하지 않으면 빈 문자열을 반환한다', () => {
      expect(DateUtil.formatDateRange(null, null)).toBe('');
    });
  });
});
