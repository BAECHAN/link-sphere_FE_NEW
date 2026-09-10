/**
 * 전역 상수
 */

// OS 감지 (SSR 환경 고려)
export const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/i.test(navigator.userAgent);

export const STALE_TIME_ONE_DAY = 1000 * 60 * 60 * 24; // 24시간

// 조회 로딩(스피너·스켈레톤)을 띄우기 전 기다리는 시간 — 이보다 빨리 끝나면 표시하지 않는다.
// NN/g 응답시간 3한계(https://www.nngroup.com/articles/response-times-3-important-limits/)의
// "0.1~1.0초 지연에는 보통 특별한 피드백이 불필요하다"는 구간 안쪽 값이다.
/** 조회 로딩 인디케이터를 띄우기 전 기다리는 시간 */
export const LOADING_INDICATOR_DELAY_MS = 500;

// mutation(등록/수정) 진행 표시를 띄우기 전 기다리는 시간. 완료 토스트(성공/실패)보다
// 여유를 둔다 - 흔한 요청 속도(약 300~500ms)의 경계값이라 너무 짧으면 목록 도착 직후
// 잠깐 떴다 사라지는 게 부자연스러워 보였다. 조회 로딩과 값은 같지만 성격이 다른
// 별개 정책이라 상수를 분리해 둔다 - 한쪽만 조정할 수 있어야 한다.
/** mutation 진행 표시를 띄우기 전 기다리는 시간 */
export const MUTATION_PROGRESS_DELAY_MS = 500;

/** mutation 진행 표시가 한 번 보이면 최소한 유지하는 시간 — 깜빡임 방지 (mutation 전용) */
export const LOADING_INDICATOR_MIN_DURATION_MS = 400;
