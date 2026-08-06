/**
 * 전역 상수
 */

// OS 감지 (SSR 환경 고려)
export const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/i.test(navigator.userAgent);

export const STALE_TIME_ONE_DAY = 1000 * 60 * 60 * 24; // 24시간

/** 로딩 인디케이터를 띄우기 전 기다리는 시간 — 이보다 빨리 끝나면 표시하지 않는다 */
export const LOADING_INDICATOR_DELAY_MS = 300;
/** 로딩 인디케이터가 한 번 보이면 최소한 유지하는 시간 — 깜빡임 방지 */
export const LOADING_INDICATOR_MIN_DURATION_MS = 400;
