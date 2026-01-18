/**
 * 전역 상수
 */

// OS 감지 (SSR 환경 고려)
export const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/i.test(navigator.userAgent);

export const STALE_TIME_ONE_DAY = 1000 * 60 * 60 * 24; // 24시간
