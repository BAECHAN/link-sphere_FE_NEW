import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ko';
import relativeTime from 'dayjs/plugin/relativeTime';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
import customParseFormat from 'dayjs/plugin/customParseFormat';

// 플러그인 적용
dayjs.extend(relativeTime);
dayjs.extend(isToday);
dayjs.extend(isYesterday);
dayjs.extend(customParseFormat);
dayjs.locale('ko');

type DateInput = string | number | Date | Dayjs | null | undefined;

export class DateUtil {
  /**
   * dayjs 객체로 변환
   * @param date 날짜 입력값
   * @returns dayjs 객체
   */
  private static toDayjs(date: DateInput): Dayjs {
    // null은 허용
    if (date === undefined) {
      return dayjs();
    }
    return dayjs(date);
  }

  /**
   * 날짜가 유효한지 확인
   * @param date 날짜 입력값
   * @returns 유효 여부
   */
  static isValid(date: DateInput): boolean {
    return this.toDayjs(date).isValid();
  }

  /**
   * 기본 포맷: YYYY-MM-DD
   * @example '2025-01-20'
   */
  static formatDefault(date: DateInput): string {
    const d = this.toDayjs(date);
    return d.isValid() ? d.format('YYYY-MM-DD') : '';
  }

  /**
   * 한국어 날짜 포맷: YYYY년 MM월 DD일
   * @example '2025년 1월 20일'
   */
  static formatKorean(date: DateInput): string {
    const d = this.toDayjs(date);
    return d.isValid() ? d.format('YYYY년 M월 D일') : '';
  }

  /**
   * 한국어 날짜 + 요일 포맷: YYYY년 MM월 DD일 dddd
   * @example '2025년 1월 20일 월요일'
   */
  static formatKoreanWithDay(date: DateInput): string {
    const d = this.toDayjs(date);
    return d.isValid() ? d.format('YYYY년 M월 D일 dddd') : '';
  }

  /**
   * 오전/오후 시간 포맷: 오전/오후 H시 mm분
   * @example '오후 3시 30분'
   */
  static formatKoreanTime(date: DateInput): string {
    const d = this.toDayjs(date);
    if (!d.isValid()) return '';

    const hour = d.hour();
    const minute = d.minute();
    const period = hour < 12 ? '오전' : '오후';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

    if (minute === 0) {
      return `${period} ${displayHour}시`;
    }
    return `${period} ${displayHour}시 ${minute}분`;
  }

  /**
   * 날짜 + 오전/오후 시간 포맷: YYYY년 MM월 DD일 오전/오후 H시 mm분
   * @example '2025년 1월 20일 오후 3시 30분'
   */
  static formatKoreanDateTime(date: DateInput): string {
    const d = this.toDayjs(date);
    if (!d.isValid()) return '';

    const dateStr = d.format('YYYY년 M월 D일');
    const timeStr = this.formatKoreanTime(date);
    return `${dateStr} ${timeStr}`;
  }

  /**
   * 날짜 + 요일 + 오전/오후 시간 포맷: YYYY년 MM월 DD일 dddd 오전/오후 H시 mm분
   * @example '2025년 1월 20일 월요일 오후 3시 30분'
   */
  static formatKoreanDateTimeWithDay(date: DateInput): string {
    const d = this.toDayjs(date);
    if (!d.isValid()) return '';

    const dateStr = d.format('YYYY년 M월 D일 dddd');
    const timeStr = this.formatKoreanTime(date);
    return `${dateStr} ${timeStr}`;
  }

  /**
   * 시간만 포맷: HH:mm
   * @example '15:30'
   */
  static formatTime(date: DateInput): string {
    const d = this.toDayjs(date);
    return d.isValid() ? d.format('HH:mm') : '';
  }

  /**
   * 오전/오후 시간 포맷 (간단): 오전/오후 hh:mm
   * @example '오후 3:30'
   */
  static formatTimeWithPeriod(date: DateInput): string {
    const d = this.toDayjs(date);
    if (!d.isValid()) return '';

    const hour = d.hour();
    const period = hour < 12 ? '오전' : '오후';
    return `${period} ${d.format('h:mm')}`;
  }

  /**
   * 월일만 포맷: MM월 DD일
   * @example '1월 20일'
   */
  static formatMonthDay(date: DateInput): string {
    const d = this.toDayjs(date);
    return d.isValid() ? d.format('M월 D일') : '';
  }

  /**
   * 년월만 포맷: YYYY년 MM월
   * @example '2025년 1월'
   */
  static formatYearMonth(date: DateInput): string {
    const d = this.toDayjs(date);
    return d.isValid() ? d.format('YYYY년 M월') : '';
  }

  /**
   * ISO 포맷: YYYY-MM-DDTHH:mm:ss.SSSZ
   * @example '2025-01-20T15:30:00.000Z'
   */
  static formatISO(date: DateInput): string {
    const d = this.toDayjs(date);
    return d.isValid() ? d.toISOString() : '';
  }

  /**
   * 상대 시간 포맷 (오늘/어제/상대시간)
   * @example '방금 전', '3일 전', '오늘 오후 3시 30분', '어제 오후 3시 30분'
   */
  static formatRelative(date: DateInput): string {
    const d = this.toDayjs(date);
    if (!d.isValid()) return '';

    const now = dayjs();
    const diffMinutes = now.diff(d, 'minute');

    // 1분 미만: 방금 전
    if (diffMinutes < 1) {
      return '방금 전';
    }

    // 1시간 미만: X분 전
    if (diffMinutes < 60) {
      return `${diffMinutes}분 전`;
    }

    const diffHours = now.diff(d, 'hour');
    // 24시간 미만: X시간 전
    if (diffHours < 24) {
      return `${diffHours}시간 전`;
    }

    // 오늘: 오늘 오전/오후 시간
    if (d.isToday()) {
      return `오늘 ${this.formatKoreanTime(date)}`;
    }

    // 어제: 어제 오전/오후 시간
    if (d.isYesterday()) {
      return `어제 ${this.formatKoreanTime(date)}`;
    }

    const diffDays = now.diff(d, 'day');
    // 7일 미만: X일 전
    if (diffDays < 7) {
      return `${diffDays}일 전`;
    }

    // 그 외: 날짜 + 시간
    return this.formatKoreanDateTime(date);
  }

  /**
   * 상대 시간 포맷 (간단 버전)
   * @example '방금 전', '3분 전', '2시간 전', '3일 전', '2025년 1월 20일'
   */
  static formatRelativeShort(date: DateInput): string {
    const d = this.toDayjs(date);
    if (!d.isValid()) return '';

    const now = dayjs();
    const diffMinutes = now.diff(d, 'minute');

    if (diffMinutes < 1) {
      return '방금 전';
    }

    if (diffMinutes < 60) {
      return `${diffMinutes}분 전`;
    }

    const diffHours = now.diff(d, 'hour');
    if (diffHours < 24) {
      return `${diffHours}시간 전`;
    }

    const diffDays = now.diff(d, 'day');
    if (diffDays < 7) {
      return `${diffDays}일 전`;
    }

    if (diffDays < 30) {
      const diffWeeks = Math.floor(diffDays / 7);
      return `${diffWeeks}주 전`;
    }

    if (diffDays < 365) {
      const diffMonths = Math.floor(diffDays / 30);
      return `${diffMonths}개월 전`;
    }

    return this.formatKorean(date);
  }

  /**
   * 게시판 스타일 포맷
   * - 오늘: 오전/오후 시간
   * - 어제: 어제
   * - 이번 주: 요일
   * - 그 외: 월일
   * @example '오후 3시 30분', '어제', '월요일', '1월 20일'
   */
  static formatBoard(date: DateInput): string {
    const d = this.toDayjs(date);
    if (!d.isValid()) return '';

    if (d.isToday()) {
      return this.formatKoreanTime(date);
    }

    if (d.isYesterday()) {
      return '어제';
    }

    const now = dayjs();
    const diffDays = now.diff(d, 'day');

    if (diffDays < 7) {
      return d.format('dddd');
    }

    return this.formatMonthDay(date);
  }

  /**
   * 날짜 범위 포맷: 시작일 ~ 종료일
   * @example '2025년 1월 20일 ~ 2025년 1월 25일'
   */
  static formatDateRange(startDate: DateInput, endDate: DateInput, separator = ' ~ '): string {
    const start = this.toDayjs(startDate);
    const end = this.toDayjs(endDate);

    if (!start.isValid() && !end.isValid()) return '';
    if (!start.isValid()) return this.formatKorean(endDate);
    if (!end.isValid()) return this.formatKorean(startDate);

    return `${this.formatKorean(startDate)}${separator}${this.formatKorean(endDate)}`;
  }
}
