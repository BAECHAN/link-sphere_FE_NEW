import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
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

    it('기준 시각을 주면 시계가 아니라 그 시각으로 계산한다', () => {
      const writtenAt = '2025-03-01T12:00:00.000Z';
      const eighteenHoursLater = dayjs(writtenAt).add(18, 'hour').valueOf();

      // 시계(12:00)로 계산하면 "방금 전"이다
      expect(DateUtil.formatRelativeShort(writtenAt, eighteenHoursLater)).toBe('18시간 전');
    });

    // 단위가 넘어가는 경계 - 차이를 구하는 방식을 바꿔도 같은 글자가 나와야 한다
    describe('단위 경계', () => {
      const SECOND = 1000;
      const MINUTE = 60 * SECOND;
      const HOUR = 60 * MINUTE;
      const DAY = 24 * HOUR;
      const BASE_MS = dayjs('2025-03-01T12:00:00.000Z').valueOf();

      it.each([
        { elapsed: '59초', elapsedMs: 59 * SECOND, expected: '방금 전' },
        { elapsed: '1분', elapsedMs: MINUTE, expected: '1분 전' },
        { elapsed: '59분 59초', elapsedMs: HOUR - SECOND, expected: '59분 전' },
        { elapsed: '1시간', elapsedMs: HOUR, expected: '1시간 전' },
        { elapsed: '23시간 59분', elapsedMs: DAY - MINUTE, expected: '23시간 전' },
        { elapsed: '1일', elapsedMs: DAY, expected: '1일 전' },
        { elapsed: '6일 23시간', elapsedMs: 7 * DAY - HOUR, expected: '6일 전' },
        { elapsed: '7일', elapsedMs: 7 * DAY, expected: '1주 전' },
        { elapsed: '29일', elapsedMs: 29 * DAY, expected: '4주 전' },
        { elapsed: '30일', elapsedMs: 30 * DAY, expected: '1개월 전' },
        { elapsed: '364일', elapsedMs: 364 * DAY, expected: '12개월 전' },
        { elapsed: '365일', elapsedMs: 365 * DAY, expected: '2024년 3월 1일' },
      ])('$elapsed 전에 쓴 글은 "$expected"', ({ elapsedMs, expected }) => {
        expect(DateUtil.formatRelativeShort(BASE_MS - elapsedMs)).toBe(expected);
        expect(DateUtil.formatRelativeShort(BASE_MS - elapsedMs, BASE_MS)).toBe(expected);
      });

      it('ISO 문자열로 받아도 같은 글자다', () => {
        expect(DateUtil.formatRelativeShort('2025-03-01T11:01:00.000Z')).toBe('59분 전');
        expect(DateUtil.formatRelativeShort('2025-02-22T12:00:00.000Z')).toBe('1주 전');
      });

      it('기기 시계가 늦어 작성 시각이 앞서 보여도 "방금 전"이다', () => {
        expect(DateUtil.formatRelativeShort(BASE_MS + 30 * SECOND)).toBe('방금 전');
        expect(DateUtil.formatRelativeShort(BASE_MS + 2 * HOUR)).toBe('방금 전');
      });

      it('null이면 빈 문자열, undefined면 지금으로 본다', () => {
        expect(DateUtil.formatRelativeShort(null)).toBe('');
        expect(DateUtil.formatRelativeShort(undefined)).toBe('방금 전');
      });
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
